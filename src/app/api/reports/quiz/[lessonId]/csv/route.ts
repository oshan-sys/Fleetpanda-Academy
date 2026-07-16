import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { toCsv, csvResponse, slugify } from "@/lib/csv";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return new Response("Forbidden", { status: 403 });
  }

  const { lessonId } = await params;
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      module: { include: { course: true } },
      submissions: {
        include: { user: { select: { name: true, email: true } } },
        orderBy: { updatedAt: "desc" },
      },
    },
  });
  if (!lesson?.quizData) return new Response("Not found", { status: 404 });

  const quiz = lesson.quizData as unknown as { title: string; totalPoints: number };

  const rows: (string | number)[][] = [
    [
      "Learner",
      "Email",
      "Course",
      "Module",
      "Quiz",
      "Score",
      "Total points",
      "Percent",
      "Submitted at",
    ],
    ...lesson.submissions.map((s) => [
      s.user.name ?? "",
      s.user.email ?? "",
      lesson.module.course.title,
      lesson.module.title,
      quiz.title,
      s.score,
      s.totalPoints,
      s.totalPoints > 0 ? Math.round((s.score / s.totalPoints) * 100) + "%" : "",
      s.updatedAt.toISOString(),
    ]),
  ];

  return csvResponse(toCsv(rows), `quiz-${slugify(quiz.title)}.csv`);
}
