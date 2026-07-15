import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import CourseEditor from "@/components/admin/CourseEditor";

export default async function AdminCourseEditPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  await requireAdminPage();
  const { courseId } = await params;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: { lessons: { orderBy: { order: "asc" } } },
      },
      assignments: {
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      },
    },
  });
  if (!course) notFound();

  return (
    <div className="mx-auto max-w-3xl px-10 py-10">
      <Link
        href="/admin/courses"
        className="text-[13px] text-neutral-500 transition hover:text-neutral-900"
      >
        ← Manage courses
      </Link>
      <CourseEditor
        course={{
          id: course.id,
          title: course.title,
          description: course.description,
          category: course.category,
          color: course.color,
          modules: course.modules.map((m) => ({
            id: m.id,
            title: m.title,
            lessons: m.lessons.map((l) => ({
              id: l.id,
              title: l.title,
              type: l.type,
              docUrl: l.docUrl,
              loomUrl: l.loomUrl,
              formUrl: l.formUrl,
            })),
          })),
          assignedUsers: course.assignments.map((a) => ({
            id: a.user.id,
            name: a.user.name,
            email: a.user.email,
          })),
        }}
      />
    </div>
  );
}
