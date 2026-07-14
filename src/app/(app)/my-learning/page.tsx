import { requireUser } from "@/lib/session";
import {
  visibleCoursesFor,
  completedLessonIds,
  courseLessonCount,
  courseCompletedCount,
} from "@/lib/access";
import CourseCard from "@/components/CourseCard";

export default async function MyLearningPage() {
  const user = await requireUser();
  const [courses, done] = await Promise.all([
    visibleCoursesFor(user.id),
    completedLessonIds(user.id),
  ]);

  // "My learning" = courses assigned specifically to me, plus anything I've started.
  const mine = courses
    .map((c) => ({
      course: c,
      total: courseLessonCount(c),
      completed: courseCompletedCount(c, done),
      assignedToMe: c.assignments.some((a) => a.userId === user.id),
    }))
    .filter((c) => c.assignedToMe || c.completed > 0);

  const active = mine.filter((c) => c.completed < c.total || c.total === 0);
  const finished = mine.filter((c) => c.total > 0 && c.completed >= c.total);

  return (
    <div className="mx-auto max-w-5xl px-10 py-10">
      <h1 className="text-[26px] font-semibold tracking-tight">My learning</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Courses assigned to you and everything you&apos;ve started.
      </p>

      {mine.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center">
          <h2 className="text-base font-semibold">Nothing here yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">
            Start any course from Browse and it will appear here with your
            progress.
          </p>
        </div>
      )}

      {active.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3.5 text-base font-semibold tracking-tight">
            Active
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-4">
            {active.map((c) => (
              <CourseCard
                key={c.course.id}
                course={c.course}
                completed={c.completed}
                total={c.total}
              />
            ))}
          </div>
        </section>
      )}

      {finished.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3.5 text-base font-semibold tracking-tight">
            Completed
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-4">
            {finished.map((c) => (
              <CourseCard
                key={c.course.id}
                course={c.course}
                completed={c.completed}
                total={c.total}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
