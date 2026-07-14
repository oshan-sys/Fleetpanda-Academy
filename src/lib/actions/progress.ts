"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

async function assertLessonAccess(userId: string, lessonId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      module: {
        include: { course: { include: { assignments: true } } },
      },
    },
  });
  if (!lesson) throw new Error("Lesson not found");
  const { course } = lesson.module;
  const open = course.assignments.length === 0;
  const mine = course.assignments.some((a) => a.userId === userId);
  if (!open && !mine) throw new Error("Forbidden");
  return lesson;
}

export async function markLessonComplete(lessonId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Not signed in");
  const lesson = await assertLessonAccess(user.id, lessonId);

  await prisma.progress.upsert({
    where: { userId_lessonId: { userId: user.id, lessonId } },
    update: {},
    create: { userId: user.id, lessonId },
  });

  revalidatePath("/");
  revalidatePath(`/courses/${lesson.module.courseId}`);
  revalidatePath(`/courses/${lesson.module.courseId}/lessons/${lessonId}`);
}

export async function unmarkLessonComplete(lessonId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Not signed in");
  const lesson = await assertLessonAccess(user.id, lessonId);

  await prisma.progress.deleteMany({
    where: { userId: user.id, lessonId },
  });

  revalidatePath("/");
  revalidatePath(`/courses/${lesson.module.courseId}`);
  revalidatePath(`/courses/${lesson.module.courseId}/lessons/${lessonId}`);
}
