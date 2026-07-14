import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import {
  getAccessibleCourse,
  completedLessonIds,
  courseLessonCount,
  courseCompletedCount,
} from "@/lib/access";
import { ProgressBar } from "@/components/ProgressBar";
import TypeBadge from "@/components/TypeBadge";

export default async function CoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const user = await requireUser();
  const { courseId } = await params;
  const [course, done] = await Promise.all([
    getAccessibleCourse(user.id, courseId),
    completedLessonIds(user.id),
  ]);
  if (!course) notFound();

  const total = courseLessonCount(course);
  const completed = courseCompletedCount(course, done);
  const nextLesson = course.modules
    .flatMap((m) => m.lessons)
    .find((l) => !done.has(l.id));

  return (
    <div className="mx-auto max-w-3xl px-10 py-10">
      <Link
        href="/browse"
        className="text-[13px] text-neutral-500 transition hover:text-neutral-900"
      >
        ← Browse courses
      </Link>

      <div className="mt-4 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: course.color }}
            />
            <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] tracking-[0.14em] text-neutral-600">
              {course.category.toUpperCase()}
            </span>
          </div>
          <h1 className="mt-3 text-[26px] font-semibold tracking-tight">
            {course.title}
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-neutral-500">
            {course.description}
          </p>
        </div>
        {nextLesson && (
          <Link
            href={`/courses/${course.id}/lessons/${nextLesson.id}`}
            className="shrink-0 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            {completed === 0 ? "Start course" : "Continue"}
          </Link>
        )}
      </div>

      <div className="mt-6">
        <ProgressBar completed={completed} total={total} />
        <div className="mt-2 flex justify-between font-mono text-xs text-neutral-500">
          <span>
            {completed} of {total} lessons complete
          </span>
          <span>{total === 0 ? "—" : `${Math.round((completed / Math.max(total, 1)) * 100)}%`}</span>
        </div>
      </div>

      <div className="mt-8 space-y-6">
        {course.modules.map((mod, mi) => (
          <section
            key={mod.id}
            className="overflow-hidden rounded-xl border border-neutral-200 bg-white"
          >
            <div className="flex items-baseline gap-3 border-b border-neutral-100 px-5 py-3.5">
              <span className="font-mono text-[11px] text-neutral-400">
                {String(mi + 1).padStart(2, "0")}
              </span>
              <h2 className="text-[15px] font-semibold tracking-tight">
                {mod.title}
              </h2>
              <span className="ml-auto font-mono text-[11px] text-neutral-400">
                {mod.lessons.filter((l) => done.has(l.id)).length}/
                {mod.lessons.length}
              </span>
            </div>
            {mod.lessons.length === 0 ? (
              <div className="px-5 py-4 text-[13px] text-neutral-400">
                No lessons in this module yet.
              </div>
            ) : (
              mod.lessons.map((lesson) => {
                const isDone = done.has(lesson.id);
                return (
                  <Link
                    key={lesson.id}
                    href={`/courses/${course.id}/lessons/${lesson.id}`}
                    className="flex items-center gap-3.5 border-t border-neutral-100 px-5 py-3.5 transition first:border-t-0 hover:bg-neutral-50"
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                        isDone
                          ? "border-pine-600 bg-pine-600 text-white"
                          : "border-neutral-300 bg-white"
                      }`}
                    >
                      {isDone && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </span>
                    <span
                      className={`min-w-0 flex-1 truncate text-sm ${
                        isDone ? "text-neutral-500" : "font-medium text-neutral-900"
                      }`}
                    >
                      {lesson.title}
                    </span>
                    <TypeBadge type={lesson.type} />
                  </Link>
                );
              })
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
