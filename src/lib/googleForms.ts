// Google Forms API helpers. All calls use a user's OAuth token (the admin
// who pasted the form, or the admin viewing reports) — the app has no
// service account.

export interface QuizQuestion {
  id: string;
  title: string;
  type: "RADIO" | "CHECKBOX" | "DROP_DOWN" | "TEXT" | "PARAGRAPH";
  required: boolean;
  options?: string[];
  points: number;
  /** Answer key — server-only, never sent to the client. */
  correct?: string[];
}

export interface QuizData {
  title: string;
  questions: QuizQuestion[];
  totalPoints: number;
  importedAt: string;
}

export interface FormInfo {
  formId: string;
  title: string;
  responderUri: string;
  /** Sum of point values across graded questions; 0 when not a quiz. */
  totalPoints: number;
  isQuiz: boolean;
  /** Importable quiz structure (questions the app can render natively). */
  quiz: QuizData;
  /** Count of questions with no answer key (can't be auto-graded). */
  ungradedCount: number;
}

export interface FormResponseRow {
  email: string | null;
  score: number | null;
  submittedAt: string;
}

interface FormsApiForm {
  formId: string;
  info?: { title?: string; documentTitle?: string };
  responderUri?: string;
  settings?: { quizSettings?: { isQuiz?: boolean } };
  items?: {
    itemId?: string;
    title?: string;
    questionItem?: {
      question?: {
        questionId?: string;
        required?: boolean;
        grading?: {
          pointValue?: number;
          correctAnswers?: { answers?: { value?: string }[] };
        };
        choiceQuestion?: {
          type?: "RADIO" | "CHECKBOX" | "DROP_DOWN";
          options?: { value?: string; isOther?: boolean }[];
        };
        textQuestion?: { paragraph?: boolean };
      };
    };
  }[];
}

function parseQuiz(data: FormsApiForm): { quiz: QuizData; ungradedCount: number } {
  const questions: QuizQuestion[] = [];
  let ungradedCount = 0;

  for (const item of data.items ?? []) {
    const q = item.questionItem?.question;
    if (!q?.questionId) continue; // skip non-question items (text, images…)

    let type: QuizQuestion["type"];
    let options: string[] | undefined;
    if (q.choiceQuestion) {
      type = q.choiceQuestion.type ?? "RADIO";
      options = (q.choiceQuestion.options ?? [])
        .filter((o) => !o.isOther && o.value)
        .map((o) => o.value!);
    } else if (q.textQuestion) {
      type = q.textQuestion.paragraph ? "PARAGRAPH" : "TEXT";
    } else {
      continue; // unsupported question kind (grid, scale, file upload…)
    }

    const correct = q.grading?.correctAnswers?.answers
      ?.map((a) => a.value)
      .filter((v): v is string => !!v);
    const points = q.grading?.pointValue ?? 0;
    if (!correct?.length && points > 0) ungradedCount++;

    questions.push({
      id: q.questionId,
      title: item.title || "Untitled question",
      type,
      required: q.required ?? false,
      options,
      points,
      correct: correct?.length ? correct : undefined,
    });
  }

  return {
    quiz: {
      title: data.info?.title ?? data.info?.documentTitle ?? "Quiz",
      questions,
      totalPoints: questions.reduce((s, q) => s + q.points, 0),
      importedAt: new Date().toISOString(),
    },
    ungradedCount,
  };
}

export async function getFormInfo(
  accessToken: string,
  formId: string
): Promise<{ ok: true; form: FormInfo } | { ok: false; status: number; body: string }> {
  const res = await fetch(
    `https://forms.googleapis.com/v1/forms/${encodeURIComponent(formId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    return { ok: false, status: res.status, body: await res.text() };
  }
  const data: FormsApiForm = await res.json();
  const { quiz, ungradedCount } = parseQuiz(data);
  return {
    ok: true,
    form: {
      formId: data.formId,
      title: quiz.title,
      responderUri: data.responderUri ?? "",
      totalPoints: quiz.totalPoints,
      isQuiz: data.settings?.quizSettings?.isQuiz ?? false,
      quiz,
      ungradedCount,
    },
  };
}

export async function listFormResponses(
  accessToken: string,
  formId: string
): Promise<
  | { ok: true; responses: FormResponseRow[] }
  | { ok: false; status: number; body: string }
> {
  const rows: FormResponseRow[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(
      `https://forms.googleapis.com/v1/forms/${encodeURIComponent(formId)}/responses`
    );
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      return { ok: false, status: res.status, body: await res.text() };
    }
    const data: {
      responses?: {
        respondentEmail?: string;
        totalScore?: number;
        lastSubmittedTime?: string;
      }[];
      nextPageToken?: string;
    } = await res.json();

    for (const r of data.responses ?? []) {
      rows.push({
        email: r.respondentEmail?.toLowerCase() ?? null,
        score: r.totalScore ?? null,
        submittedAt: r.lastSubmittedTime ?? "",
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  // Keep only the latest submission per respondent email.
  const latest = new Map<string, FormResponseRow>();
  const anonymous: FormResponseRow[] = [];
  for (const row of rows) {
    if (!row.email) {
      anonymous.push(row);
      continue;
    }
    const prev = latest.get(row.email);
    if (!prev || row.submittedAt > prev.submittedAt) latest.set(row.email, row);
  }
  return { ok: true, responses: [...latest.values(), ...anonymous] };
}
