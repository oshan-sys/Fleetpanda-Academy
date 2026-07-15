"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import type { QuizData } from "@/lib/googleForms";

export type QuizAnswers = Record<string, string[]>;

export interface QuizResult {
  score: number;
  totalPoints: number;
  /** questionId → correct (null = not auto-gradable). */
  perQuestion: Record<string, boolean | null>;
}

function normalize(s: string) {
  return s.trim().toLowerCase();
}

function gradeQuestion(
  correct: string[] | undefined,
  given: string[]
): boolean | null {
  if (!correct?.length) return null;
  const want = new Set(correct.map(normalize));
  const got = new Set(given.map(normalize));
  if (want.size !== got.size) return false;
  for (const v of want) if (!got.has(v)) return false;
  return true;
}

export async function submitQuiz(
  lessonId: string,
  answers: QuizAnswers
): Promise<QuizResult> {
  const user = await getSessionUser();
  if (!user) throw new Error("Not signed in");

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      module: { include: { course: { include: { assignments: true } } } },
    },
  });
  if (!lesson?.quizData) throw new Error("Quiz not found");

  const { course } = lesson.module;
  const open = course.assignments.length === 0;
  const mine = course.assignments.some((a) => a.userId === user.id);
  if (!open && !mine) throw new Error("Forbidden");

  const quiz = lesson.quizData as unknown as QuizData;

  let score = 0;
  const perQuestion: Record<string, boolean | null> = {};
  for (const q of quiz.questions) {
    const given = answers[q.id] ?? [];
    const result =
      q.type === "PARAGRAPH" ? null : gradeQuestion(q.correct, given);
    perQuestion[q.id] = result;
    if (result === true) score += q.points;
  }

  await prisma.$transaction([
    prisma.quizSubmission.upsert({
      where: { lessonId_userId: { lessonId, userId: user.id } },
      update: { answers, score, totalPoints: quiz.totalPoints },
      create: {
        lessonId,
        userId: user.id,
        answers,
        score,
        totalPoints: quiz.totalPoints,
      },
    }),
    // Submitting the quiz counts as completing the lesson.
    prisma.progress.upsert({
      where: { userId_lessonId: { userId: user.id, lessonId } },
      update: {},
      create: { userId: user.id, lessonId },
    }),
  ]);

  revalidatePath("/");
  revalidatePath(`/courses/${lesson.module.courseId}`);
  revalidatePath(`/courses/${lesson.module.courseId}/lessons/${lessonId}`);
  revalidatePath("/admin/reports");

  return { score, totalPoints: quiz.totalPoints, perQuestion };
}
