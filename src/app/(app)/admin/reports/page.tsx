import { requireAdminPage } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { ProgressBar } from "@/components/ProgressBar";
import { Donut, HBarChart, ScoreHistogram } from "@/components/charts";
import { getGoogleAccessToken } from "@/lib/googleDrive";
import { getFormInfo, listFormResponses } from "@/lib/googleForms";

interface QuizReport {
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  courseTitle: string;
  totalPoints: number | null;
  /** Native (imported) quizzes support CSV export. */
  isNative: boolean;
  error?: string;
  rows: {
    name: string | null;
    email: string;
    score: number | null;
    submittedAt: string;
  }[];
}

async function buildQuizReports(
  adminId: string,
  users: { id: string; name: string | null; email: string | null }[]
): Promise<{ reports: QuizReport[]; tokenMissing: boolean }> {
  const quizLessons = await prisma.lesson.findMany({
    where: {
      OR: [{ quizData: { not: Prisma.DbNull } }, { formId: { not: null } }],
    },
    include: {
      module: { include: { course: true } },
      submissions: {
        include: { user: { select: { name: true, email: true } } },
        orderBy: { updatedAt: "desc" },
      },
    },
    orderBy: { title: "asc" },
  });
  if (quizLessons.length === 0) return { reports: [], tokenMissing: false };

  // Native quizzes (imported into the app): read submissions from our DB.
  const native = quizLessons
    .filter((l) => l.quizData)
    .map((lesson): QuizReport => {
      const quiz = lesson.quizData as unknown as { totalPoints: number };
      return {
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        moduleTitle: lesson.module.title,
        courseTitle: lesson.module.course.title,
        totalPoints: quiz.totalPoints || null,
        isNative: true,
        rows: lesson.submissions.map((s) => ({
          name: s.user.name,
          email: s.user.email ?? "",
          score: s.score,
          submittedAt: s.updatedAt.toISOString(),
        })),
      };
    });

  // Legacy Google-Form lessons (linked before native import existed):
  // pull responses via the Forms API with the viewing admin's token.
  const legacy = quizLessons.filter((l) => !l.quizData && l.formId);
  if (legacy.length === 0) return { reports: native, tokenMissing: false };

  const token = await getGoogleAccessToken(adminId);
  if (!token) return { reports: native, tokenMissing: true };

  const usersByEmail = new Map(
    users.filter((u) => u.email).map((u) => [u.email!.toLowerCase(), u])
  );

  const legacyReports = await Promise.all(
    legacy.map(async (lesson): Promise<QuizReport> => {
      const base = {
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        moduleTitle: lesson.module.title,
        courseTitle: lesson.module.course.title,
        isNative: false,
      };
      const [info, resp] = await Promise.all([
        getFormInfo(token, lesson.formId!),
        listFormResponses(token, lesson.formId!),
      ]);
      if (!resp.ok) {
        return {
          ...base,
          totalPoints: null,
          rows: [],
          error:
            resp.status === 403
              ? "No access to this form's responses — the form owner must add you as a collaborator (or view results in Google Forms directly)."
              : `Couldn't load responses (Google returned ${resp.status}).`,
        };
      }
      return {
        ...base,
        totalPoints: info.ok ? info.form.totalPoints : null,
        rows: resp.responses.map((r) => {
          const user = r.email ? usersByEmail.get(r.email) : undefined;
          return {
            name: user?.name ?? null,
            email: r.email ?? "(no email collected)",
            score: r.score,
            submittedAt: r.submittedAt,
          };
        }),
      };
    })
  );
  return { reports: [...native, ...legacyReports], tokenMissing: false };
}

export default async function ReportsPage() {
  const me = await requireAdminPage();

  const [courses, users, progress] = await Promise.all([
    prisma.course.findMany({
      include: {
        modules: {
          orderBy: { order: "asc" },
          include: { lessons: { select: { id: true, title: true } } },
        },
        assignments: { select: { userId: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.progress.findMany({
      select: { userId: true, lessonId: true },
    }),
  ]);

  const doneByUser = new Map<string, Set<string>>();
  for (const p of progress) {
    if (!doneByUser.has(p.userId)) doneByUser.set(p.userId, new Set());
    doneByUser.get(p.userId)!.add(p.lessonId);
  }
  const completionsByLesson = new Map<string, number>();
  for (const p of progress) {
    completionsByLesson.set(
      p.lessonId,
      (completionsByLesson.get(p.lessonId) ?? 0) + 1
    );
  }

  // Eligible audience per course: assigned users if restricted, else everyone.
  const courseStats = courses.map((course) => {
    const audience =
      course.assignments.length > 0
        ? course.assignments.map((a) => a.userId)
        : users.map((u) => u.id);
    const lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
    const cells = audience.length * lessonIds.length;
    let completedCells = 0;
    for (const uid of audience) {
      const done = doneByUser.get(uid);
      if (!done) continue;
      for (const lid of lessonIds) if (done.has(lid)) completedCells++;
    }
    const moduleStats = course.modules.map((m) => {
      const mLessonIds = m.lessons.map((l) => l.id);
      const mCells = audience.length * mLessonIds.length;
      let mDone = 0;
      for (const uid of audience) {
        const done = doneByUser.get(uid);
        if (!done) continue;
        for (const lid of mLessonIds) if (done.has(lid)) mDone++;
      }
      return {
        id: m.id,
        title: m.title,
        rate: mCells === 0 ? 0 : mDone / mCells,
      };
    });
    return {
      course,
      audienceSize: audience.length,
      lessonCount: lessonIds.length,
      rate: cells === 0 ? 0 : completedCells / cells,
      moduleStats,
    };
  });

  // Per-learner: completed lessons vs total lessons visible to them.
  const learnerStats = users.map((u) => {
    const done = doneByUser.get(u.id) ?? new Set<string>();
    let visibleLessons = 0;
    let completed = 0;
    let coursesStarted = 0;
    let coursesCompleted = 0;
    for (const { course } of courseStats) {
      const visible =
        course.assignments.length === 0 ||
        course.assignments.some((a) => a.userId === u.id);
      if (!visible) continue;
      const lessonIds = course.modules.flatMap((m) =>
        m.lessons.map((l) => l.id)
      );
      const doneHere = lessonIds.filter((id) => done.has(id)).length;
      visibleLessons += lessonIds.length;
      completed += doneHere;
      if (doneHere > 0) coursesStarted++;
      if (lessonIds.length > 0 && doneHere === lessonIds.length)
        coursesCompleted++;
    }
    return { user: u, visibleLessons, completed, coursesStarted, coursesCompleted };
  });

  // Learner–course pairs by status, for the overview donut.
  let pairsDone = 0;
  let pairsActive = 0;
  let pairsIdle = 0;
  for (const u of users) {
    const done = doneByUser.get(u.id) ?? new Set<string>();
    for (const { course } of courseStats) {
      const visible =
        course.assignments.length === 0 ||
        course.assignments.some((a) => a.userId === u.id);
      if (!visible) continue;
      const lessonIds = course.modules.flatMap((m) =>
        m.lessons.map((l) => l.id)
      );
      if (lessonIds.length === 0) continue;
      const doneHere = lessonIds.filter((id) => done.has(id)).length;
      if (doneHere === lessonIds.length) pairsDone++;
      else if (doneHere > 0) pairsActive++;
      else pairsIdle++;
    }
  }
  const pairsTotal = pairsDone + pairsActive + pairsIdle;

  const { reports: quizReports, tokenMissing } = await buildQuizReports(
    me.id,
    users
  );

  // Most / least completed lessons across all courses.
  const allLessons = courses.flatMap((c) =>
    c.modules.flatMap((m) =>
      m.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        course: c.title,
        module: m.title,
        completions: completionsByLesson.get(l.id) ?? 0,
      }))
    )
  );
  const ranked = [...allLessons].sort((a, b) => b.completions - a.completions);
  const most = ranked.slice(0, 5);
  const least = ranked.slice(-5).reverse();

  return (
    <div className="mx-auto max-w-5xl px-10 py-10">
      <h1 className="text-[26px] font-semibold tracking-tight">Reports</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Completion across all {users.length} people who have signed in.
      </p>

      {/* At a glance */}
      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-[15px] font-semibold tracking-tight">
            Course enrollments by status
          </h2>
          <p className="mt-0.5 mb-4 text-xs text-neutral-500">
            Every learner–course combination, by how far along it is.
          </p>
          <Donut
            segments={[
              { label: "Completed", count: pairsDone, color: "#0D9488" },
              { label: "In progress", count: pairsActive, color: "#EA580C" },
              { label: "Not started", count: pairsIdle, color: "#E7E5E4" },
            ]}
            centerValue={
              pairsTotal === 0
                ? "—"
                : `${Math.round((pairsDone / pairsTotal) * 100)}%`
            }
            centerLabel="completed"
          />
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-[15px] font-semibold tracking-tight">
            Completion rate by course
          </h2>
          <p className="mt-0.5 mb-4 text-xs text-neutral-500">
            Lessons completed as a share of all lessons × enrolled learners.
          </p>
          <HBarChart
            items={courseStats.map((c) => ({
              label: c.course.title,
              value: c.rate,
              display: `${Math.round(c.rate * 100)}%`,
            }))}
          />
        </div>
      </section>

      {/* Per-course completion */}
      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold tracking-tight">
          Completion by course
        </h2>
        <div className="space-y-4">
          {courseStats.map(({ course, audienceSize, lessonCount, rate, moduleStats }) => (
            <div
              key={course.id}
              className="rounded-xl border border-neutral-200 bg-white p-5"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: course.color }}
                />
                <span className="text-[15px] font-semibold">{course.title}</span>
                <span className="ml-auto font-mono text-xs text-neutral-500">
                  {audienceSize} learners · {lessonCount} lessons
                </span>
                <span className="w-12 text-right font-mono text-sm font-semibold">
                  {Math.round(rate * 100)}%
                </span>
              </div>
              <ProgressBar
                completed={Math.round(rate * 100)}
                total={100}
                className="mt-3"
              />
              {moduleStats.length > 0 && (
                <div className="mt-4 grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
                  {moduleStats.map((m) => (
                    <div key={m.id} className="flex items-center gap-3">
                      <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-600">
                        {m.title}
                      </span>
                      <div className="h-1 w-24 overflow-hidden rounded-full bg-neutral-100">
                        <div
                          className="h-full rounded-full bg-neutral-400"
                          style={{ width: `${Math.round(m.rate * 100)}%` }}
                        />
                      </div>
                      <span className="w-9 text-right font-mono text-[11px] text-neutral-500">
                        {Math.round(m.rate * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Per-learner table */}
      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">
            Progress by learner
          </h2>
          <a
            href="/api/reports/learners/csv"
            download
            className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-[12px] font-medium text-neutral-700 transition hover:bg-neutral-100"
          >
            Export CSV ↓
          </a>
        </div>
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 font-mono text-[10px] tracking-[0.14em] text-neutral-500">
                <th className="px-5 py-3 font-medium">PERSON</th>
                <th className="px-5 py-3 font-medium">LESSONS DONE</th>
                <th className="px-5 py-3 font-medium">COURSES DONE</th>
                <th className="w-56 px-5 py-3 font-medium">OVERALL</th>
              </tr>
            </thead>
            <tbody>
              {learnerStats.map(({ user, visibleLessons, completed, coursesCompleted, coursesStarted }) => (
                <tr key={user.id} className="border-b border-neutral-100 last:border-b-0">
                  <td className="px-5 py-3">
                    <div className="font-medium">{user.name ?? "Unnamed"}</div>
                    <div className="text-xs text-neutral-500">{user.email}</div>
                  </td>
                  <td className="px-5 py-3 font-mono text-[13px]">
                    {completed} / {visibleLessons}
                  </td>
                  <td className="px-5 py-3 font-mono text-[13px]">
                    {coursesCompleted}
                    <span className="text-neutral-400"> done</span> · {coursesStarted}
                    <span className="text-neutral-400"> started</span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <ProgressBar
                        completed={completed}
                        total={Math.max(visibleLessons, 1)}
                        className="flex-1"
                      />
                      <span className="w-9 text-right font-mono text-[11px] text-neutral-500">
                        {visibleLessons === 0 ? 0 : Math.round((completed / visibleLessons) * 100)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {learnerStats.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-neutral-500">
                    Nobody has signed in yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Quiz results */}
      {(quizReports.length > 0 || tokenMissing) && (
        <section className="mt-10">
          <h2 className="mb-3 text-base font-semibold tracking-tight">
            Quiz results
          </h2>
          {tokenMissing ? (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
              Sign out and sign back in to grant quiz-results access, then
              reload this page.
            </div>
          ) : (
            <div className="space-y-4">
              {quizReports.map((q, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-xl border border-neutral-200 bg-white"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-neutral-100 px-5 py-3.5">
                    <div className="min-w-0">
                      <div className="text-[15px] font-semibold">
                        {q.lessonTitle}
                      </div>
                      <div className="text-xs text-neutral-400">
                        {q.courseTitle} · {q.moduleTitle}
                      </div>
                    </div>
                    <span className="ml-auto font-mono text-xs text-neutral-500">
                      {q.rows.length}{" "}
                      {q.rows.length === 1 ? "submission" : "submissions"}
                      {q.totalPoints ? ` · out of ${q.totalPoints} pts` : ""}
                    </span>
                    {q.isNative && q.rows.length > 0 && (
                      <a
                        href={`/api/reports/quiz/${q.lessonId}/csv`}
                        download
                        className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-[12px] font-medium text-neutral-700 transition hover:bg-neutral-100"
                      >
                        Export CSV ↓
                      </a>
                    )}
                  </div>
                  {q.totalPoints !== null &&
                    q.totalPoints > 0 &&
                    q.rows.filter((r) => r.score !== null).length > 0 && (
                      <div className="flex flex-wrap items-center gap-8 border-b border-neutral-100 px-5 py-4">
                        <div>
                          <div className="font-mono text-[10px] tracking-[0.14em] text-neutral-500">
                            AVERAGE
                          </div>
                          <div className="mt-1 text-2xl font-semibold tracking-tight">
                            {Math.round(
                              (q.rows
                                .filter((r) => r.score !== null)
                                .reduce((s, r) => s + (r.score ?? 0), 0) /
                                q.rows.filter((r) => r.score !== null).length /
                                q.totalPoints) *
                                100
                            )}
                            %
                          </div>
                        </div>
                        <div className="min-w-0">
                          <div className="mb-1 font-mono text-[10px] tracking-[0.14em] text-neutral-500">
                            SCORE DISTRIBUTION
                          </div>
                          <ScoreHistogram
                            percents={q.rows
                              .filter((r) => r.score !== null)
                              .map((r) =>
                                Math.round(
                                  ((r.score ?? 0) / q.totalPoints!) * 100
                                )
                              )}
                          />
                        </div>
                      </div>
                    )}
                  {q.error ? (
                    <div className="px-5 py-4 text-[13px] text-amber-700">
                      {q.error}
                    </div>
                  ) : q.rows.length === 0 ? (
                    <div className="px-5 py-4 text-[13px] text-neutral-400">
                      No submissions yet.
                    </div>
                  ) : (
                    <table className="w-full text-left text-sm">
                      <tbody>
                        {q.rows.map((r, ri) => (
                          <tr
                            key={ri}
                            className="border-t border-neutral-100 first:border-t-0"
                          >
                            <td className="px-5 py-2.5">
                              <span className="font-medium">
                                {r.name ?? "Not a registered learner"}
                              </span>
                              <span className="ml-2 text-xs text-neutral-500">
                                {r.email}
                              </span>
                            </td>
                            <td className="px-5 py-2.5 text-right font-mono text-[13px]">
                              {r.score !== null ? (
                                <span
                                  className={
                                    q.totalPoints &&
                                    r.score >= q.totalPoints * 0.7
                                      ? "text-pine-700"
                                      : "text-neutral-700"
                                  }
                                >
                                  {r.score}
                                  {q.totalPoints ? ` / ${q.totalPoints}` : ""}
                                </span>
                              ) : (
                                <span className="text-neutral-400">
                                  ungraded
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-2.5 text-right font-mono text-[11px] text-neutral-400">
                              {r.submittedAt
                                ? new Date(r.submittedAt).toLocaleDateString()
                                : ""}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Most / least completed */}
      <section className="mt-10 grid gap-4 lg:grid-cols-2">
        <ContentRankCard title="Most completed content" rows={most} />
        <ContentRankCard title="Least completed content" rows={least} accent="low" />
      </section>
    </div>
  );
}

function ContentRankCard({
  title,
  rows,
  accent,
}: {
  title: string;
  rows: { id: string; title: string; course: string; module: string; completions: number }[];
  accent?: "low";
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
      <div className="mt-3 space-y-2.5">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">{r.title}</div>
              <div className="truncate text-[11px] text-neutral-400">
                {r.course} · {r.module}
              </div>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[11px] font-medium ${
                accent === "low"
                  ? "bg-red-50 text-red-700"
                  : "bg-pine-50 text-pine-700"
              }`}
            >
              {r.completions} {r.completions === 1 ? "completion" : "completions"}
            </span>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="text-[13px] text-neutral-400">No lessons yet.</div>
        )}
      </div>
    </div>
  );
}
