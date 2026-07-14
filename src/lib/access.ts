import { prisma } from "@/lib/prisma";

/**
 * A course with zero Assignment rows is open to everyone; otherwise it is
 * visible only to the users listed in its assignments.
 */
const visibilityWhere = (userId: string) => ({
  OR: [
    { assignments: { none: {} } },
    { assignments: { some: { userId } } },
  ],
});

export function visibleCoursesFor(userId: string) {
  return prisma.course.findMany({
    where: visibilityWhere(userId),
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: { lessons: { orderBy: { order: "asc" } } },
      },
      assignments: { select: { userId: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export function getAccessibleCourse(userId: string, courseId: string) {
  return prisma.course.findFirst({
    where: { id: courseId, ...visibilityWhere(userId) },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: { lessons: { orderBy: { order: "asc" } } },
      },
    },
  });
}

export async function completedLessonIds(userId: string): Promise<Set<string>> {
  const rows = await prisma.progress.findMany({
    where: { userId },
    select: { lessonId: true },
  });
  return new Set(rows.map((r) => r.lessonId));
}

export type CourseWithContent = NonNullable<
  Awaited<ReturnType<typeof getAccessibleCourse>>
>;

export function courseLessonCount(course: {
  modules: { lessons: { id: string }[] }[];
}): number {
  return course.modules.reduce((a, m) => a + m.lessons.length, 0);
}

export function courseCompletedCount(
  course: { modules: { lessons: { id: string }[] }[] },
  done: Set<string>
): number {
  return course.modules.reduce(
    (a, m) => a + m.lessons.filter((l) => done.has(l.id)).length,
    0
  );
}
