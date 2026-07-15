import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getAccessibleCourse, completedLessonIds } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import type { QuizData } from "@/lib/googleForms";
import LessonContent from "@/components/LessonContent";
import MarkCompleteButton from "@/components/MarkCompleteButton";
import TypeBadge from "@/components/TypeBadge";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const user = await requireUser();
  const { courseId, lessonId } = await params;
  const [course, done] = await Promise.all([
    getAccessibleCourse(user.id, courseId),
    completedLessonIds(user.id),
  ]);
  if (!course) notFound();

  const flat = course.modules.flatMap((m) =>
    m.lessons.map((l) => ({ ...l, moduleTitle: m.title }))
  );
  const idx = flat.findIndex((l) => l.id === lessonId);
  if (idx === -1) notFound();
  const lesson = flat[idx];
  const next = flat[idx + 1] ?? null;
  const prev = flat[idx - 1] ?? null;
  const isComplete = done.has(lesson.id);

  // Native quiz: strip the answer key before anything reaches the client,
  // and load the learner's previous attempt.
  let quiz = null;
  let previousScore: number | null = null;
  if (lesson.quizData) {
    const data = lesson.quizData as unknown as QuizData;
    quiz = {
      title: data.title,
      totalPoints: data.totalPoints,
      questions: data.questions.map((q) => ({
        id: q.id,
        title: q.title,
        type: q.type,
        required: q.required,
        options: q.options,
        points: q.points,
      })),
    };
    const submission = await prisma.quizSubmission.findUnique({
      where: { lessonId_userId: { lessonId: lesson.id, userId: user.id } },
      select: { score: true },
    });
    previousScore = submission?.score ?? null;
  }

  return (
    <div className="flex min-h-screen">
      <div className="min-w-0 flex-1 px-10 py-8">
        <div className="mx-auto max-w-3xl">
          <Link
            href={`/courses/${course.id}`}
            className="text-[13px] text-neutral-500 transition hover:text-neutral-900"
          >
            ← {course.title}
          </Link>

          <div className="mt-4 flex items-center gap-2.5">
            <span className="font-mono text-[11px] tracking-[0.18em] text-neutral-500">
              {lesson.moduleTitle.toUpperCase()}
            </span>
            <TypeBadge type={lesson.type} />
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {lesson.title}
          </h1>

          <div className="mt-6">
            <LessonContent
              lessonId={lesson.id}
              docUrl={lesson.docUrl}
              loomUrl={lesson.loomUrl}
              formUrl={lesson.formUrl}
              formResponderUri={lesson.formResponderUri}
              quiz={quiz}
              previousScore={previousScore}
            />
          </div>

          <div className="mt-8 flex items-center gap-4 border-t border-neutral-200 pt-6">
            <MarkCompleteButton lessonId={lesson.id} isComplete={isComplete} />
            {next && (
              <Link
                href={`/courses/${course.id}/lessons/${next.id}`}
                className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-neutral-100"
              >
                Next lesson →
              </Link>
            )}
            {prev && (
              <Link
                href={`/courses/${course.id}/lessons/${prev.id}`}
                className="text-[13px] text-neutral-500 hover:text-neutral-900"
              >
                ← Previous
              </Link>
            )}
          </div>
        </div>
      </div>

      <aside className="sticky top-0 hidden h-screen w-80 shrink-0 overflow-y-auto border-l border-neutral-200 bg-white px-5 py-8 lg:block">
        <div className="font-mono text-[11px] tracking-[0.18em] text-neutral-500">
          IN THIS COURSE
        </div>
        <h2 className="mt-2 text-[15px] font-semibold tracking-tight">
          {course.title}
        </h2>

        <div className="mt-5 space-y-5">
          {course.modules.map((mod) => (
            <div key={mod.id}>
              <div className="mb-1.5 text-[12px] font-semibold text-neutral-500">
                {mod.title}
              </div>
              <div className="space-y-0.5">
                {mod.lessons.map((l) => {
                  const active = l.id === lesson.id;
                  const lDone = done.has(l.id);
                  return (
                    <Link
                      key={l.id}
                      href={`/courses/${course.id}/lessons/${l.id}`}
                      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition ${
                        active
                          ? "bg-brand-50 font-medium text-brand-900"
                          : "text-neutral-600 hover:bg-neutral-50"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                          lDone
                            ? "border-pine-600 bg-pine-600 text-white"
                            : active
                              ? "border-brand-600"
                              : "border-neutral-300"
                        }`}
                      >
                        {lDone && (
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </span>
                      <span className="truncate">{l.title}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
