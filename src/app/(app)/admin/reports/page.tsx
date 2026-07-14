import { requireAdminPage } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ProgressBar } from "@/components/ProgressBar";

export default async function ReportsPage() {
  await requireAdminPage();

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
        <h2 className="mb-3 text-base font-semibold tracking-tight">
          Progress by learner
        </h2>
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
