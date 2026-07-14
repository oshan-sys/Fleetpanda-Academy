import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  visibleCoursesFor,
  completedLessonIds,
  courseLessonCount,
  courseCompletedCount,
} from "@/lib/access";
import CourseCard from "@/components/CourseCard";
import { ProgressBar } from "@/components/ProgressBar";

export default async function DashboardPage() {
  const user = await requireUser();
  const [courses, done] = await Promise.all([
    visibleCoursesFor(user.id),
    completedLessonIds(user.id),
  ]);

  const withCounts = courses.map((c) => ({
    course: c,
    total: courseLessonCount(c),
    completed: courseCompletedCount(c, done),
  }));

  const inProgress = withCounts.filter(
    (c) => c.completed > 0 && c.completed < c.total
  );
  const notStarted = withCounts.filter((c) => c.completed === 0 && c.total > 0);
  const finished = withCounts.filter(
    (c) => c.total > 0 && c.completed >= c.total
  );

  // "Continue where you left off": most recent progress → next incomplete
  // lesson in that course; fall back to the first incomplete course.
  const lastProgress = await prisma.progress.findFirst({
    where: { userId: user.id },
    orderBy: { completedAt: "desc" },
    include: { lesson: { include: { module: true } } },
  });

  let continueTarget: {
    courseId: string;
    courseTitle: string;
    lessonId: string;
    lessonTitle: string;
    completed: number;
    total: number;
  } | null = null;

  const candidateCourses = lastProgress
    ? [
        ...withCounts.filter(
          (c) => c.course.id === lastProgress.lesson.module.courseId
        ),
        ...withCounts,
      ]
    : withCounts;

  for (const { course, total, completed } of candidateCourses) {
    if (total === 0 || completed >= total) continue;
    const nextLesson = course.modules
      .flatMap((m) => m.lessons)
      .find((l) => !done.has(l.id));
    if (nextLesson) {
      continueTarget = {
        courseId: course.id,
        courseTitle: course.title,
        lessonId: nextLesson.id,
        lessonTitle: nextLesson.title,
        completed,
        total,
      };
      break;
    }
  }

  const firstName = (user.name ?? "there").split(/\s+/)[0];

  return (
    <div className="mx-auto max-w-5xl px-10 py-10">
      <h1 className="text-[26px] font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Welcome back, {firstName}.
      </p>

      {continueTarget ? (
        <div className="mt-7 rounded-xl border border-neutral-200 bg-white p-6 shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="font-mono text-[11px] tracking-[0.18em] text-brand-700">
                CONTINUE WHERE YOU LEFT OFF
              </div>
              <h2 className="mt-2 text-lg font-semibold tracking-tight">
                {continueTarget.courseTitle}
              </h2>
              <div className="mt-0.5 text-sm text-neutral-500">
                Next up · {continueTarget.lessonTitle}
              </div>
            </div>
            <Link
              href={`/courses/${continueTarget.courseId}/lessons/${continueTarget.lessonId}`}
              className="shrink-0 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              {continueTarget.completed === 0 ? "Start course" : "Resume lesson"}
            </Link>
          </div>
          <ProgressBar
            completed={continueTarget.completed}
            total={continueTarget.total}
            className="mt-5"
          />
          <div className="mt-2 font-mono text-xs text-neutral-500">
            {continueTarget.completed} of {continueTarget.total} lessons complete
          </div>
        </div>
      ) : withCounts.length === 0 ? (
        <div className="mt-7 rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center">
          <h2 className="text-base font-semibold">No courses yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">
            When courses are published or assigned to you, they&apos;ll show up
            here.
          </p>
        </div>
      ) : null}

      {inProgress.length > 0 && (
        <Section title="In progress">
          {inProgress.map((c) => (
            <CourseCard key={c.course.id} course={c.course} completed={c.completed} total={c.total} />
          ))}
        </Section>
      )}

      {notStarted.length > 0 && (
        <Section title="Not started">
          {notStarted.map((c) => (
            <CourseCard key={c.course.id} course={c.course} completed={c.completed} total={c.total} />
          ))}
        </Section>
      )}

      {finished.length > 0 && (
        <Section title="Completed">
          {finished.map((c) => (
            <CourseCard key={c.course.id} course={c.course} completed={c.completed} total={c.total} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-9">
      <h2 className="mb-3.5 text-base font-semibold tracking-tight">{title}</h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-4">
        {children}
      </div>
    </section>
  );
}
