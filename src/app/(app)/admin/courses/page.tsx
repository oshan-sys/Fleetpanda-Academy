import Link from "next/link";
import { requireAdminPage } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { createCourse } from "@/lib/actions/admin";

export default async function AdminCoursesPage() {
  await requireAdminPage();

  const courses = await prisma.course.findMany({
    include: {
      modules: { include: { lessons: { select: { id: true } } } },
      assignments: { select: { id: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mx-auto max-w-4xl px-10 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">
            Manage courses
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Create, edit, and assign training content.
          </p>
        </div>
        <form action={createCourse}>
          <button
            type="submit"
            className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            + New course
          </button>
        </form>
      </div>

      <div className="mt-7 overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 font-mono text-[10px] tracking-[0.14em] text-neutral-500">
              <th className="px-5 py-3 font-medium">COURSE</th>
              <th className="px-5 py-3 font-medium">CATEGORY</th>
              <th className="px-5 py-3 font-medium">CONTENT</th>
              <th className="px-5 py-3 font-medium">VISIBILITY</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {courses.map((c) => {
              const lessonCount = c.modules.reduce(
                (a, m) => a + m.lessons.length,
                0
              );
              return (
                <tr
                  key={c.id}
                  className="border-b border-neutral-100 last:border-b-0"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: c.color }}
                      />
                      <span className="font-medium">{c.title}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-neutral-500">{c.category}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-neutral-500">
                    {c.modules.length} modules · {lessonCount} lessons
                  </td>
                  <td className="px-5 py-3.5">
                    {c.assignments.length === 0 ? (
                      <span className="rounded-full bg-pine-50 px-2 py-0.5 text-xs font-medium text-pine-700">
                        Everyone
                      </span>
                    ) : (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                        {c.assignments.length} assigned
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link
                      href={`/admin/courses/${c.id}`}
                      className="text-[13px] font-medium text-brand-700 hover:underline"
                    >
                      Edit →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {courses.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-10 text-center text-neutral-500"
                >
                  No courses yet — create your first one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
