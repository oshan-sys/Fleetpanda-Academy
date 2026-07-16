import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET() {
  const me = await getSessionUser();
  if (!me || me.role !== "ADMIN") {
    return new Response("Forbidden", { status: 403 });
  }

  const [courses, users, progress] = await Promise.all([
    prisma.course.findMany({
      include: {
        modules: { include: { lessons: { select: { id: true } } } },
        assignments: { select: { userId: true } },
      },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { name: "asc" },
    }),
    prisma.progress.findMany({ select: { userId: true, lessonId: true } }),
  ]);

  const doneByUser = new Map<string, Set<string>>();
  for (const p of progress) {
    if (!doneByUser.has(p.userId)) doneByUser.set(p.userId, new Set());
    doneByUser.get(p.userId)!.add(p.lessonId);
  }

  const rows: (string | number)[][] = [
    [
      "Learner",
      "Email",
      "Role",
      "Lessons completed",
      "Lessons available",
      "Percent",
      "Courses completed",
      "Courses started",
      "Joined",
    ],
  ];

  for (const u of users) {
    const done = doneByUser.get(u.id) ?? new Set<string>();
    let available = 0;
    let completed = 0;
    let coursesStarted = 0;
    let coursesCompleted = 0;
    for (const course of courses) {
      const visible =
        course.assignments.length === 0 ||
        course.assignments.some((a) => a.userId === u.id);
      if (!visible) continue;
      const lessonIds = course.modules.flatMap((m) =>
        m.lessons.map((l) => l.id)
      );
      const doneHere = lessonIds.filter((id) => done.has(id)).length;
      available += lessonIds.length;
      completed += doneHere;
      if (doneHere > 0) coursesStarted++;
      if (lessonIds.length > 0 && doneHere === lessonIds.length)
        coursesCompleted++;
    }
    rows.push([
      u.name ?? "",
      u.email ?? "",
      u.role,
      completed,
      available,
      available > 0 ? Math.round((completed / available) * 100) + "%" : "0%",
      coursesCompleted,
      coursesStarted,
      u.createdAt.toISOString().slice(0, 10),
    ]);
  }

  return csvResponse(toCsv(rows), "learner-progress.csv");
}
