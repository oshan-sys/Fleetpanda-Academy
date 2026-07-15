// Google Forms API helpers. All calls use a user's OAuth token (the admin
// who pasted the form, or the admin viewing reports) — the app has no
// service account.

export interface FormInfo {
  formId: string;
  title: string;
  responderUri: string;
  /** Sum of point values across graded questions; 0 when not a quiz. */
  totalPoints: number;
  isQuiz: boolean;
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
    questionItem?: { question?: { grading?: { pointValue?: number } } };
  }[];
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
  const totalPoints = (data.items ?? []).reduce(
    (sum, item) =>
      sum + (item.questionItem?.question?.grading?.pointValue ?? 0),
    0
  );
  return {
    ok: true,
    form: {
      formId: data.formId,
      title: data.info?.title ?? data.info?.documentTitle ?? "Untitled form",
      responderUri: data.responderUri ?? "",
      totalPoints,
      isQuiz: data.settings?.quizSettings?.isQuiz ?? false,
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
