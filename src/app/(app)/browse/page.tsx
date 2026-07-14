import Link from "next/link";
import { requireUser } from "@/lib/session";
import {
  visibleCoursesFor,
  completedLessonIds,
  courseLessonCount,
  courseCompletedCount,
} from "@/lib/access";
import CourseCard from "@/components/CourseCard";

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const user = await requireUser();
  const { q = "", category = "" } = await searchParams;

  const [courses, done] = await Promise.all([
    visibleCoursesFor(user.id),
    completedLessonIds(user.id),
  ]);

  const categories = Array.from(new Set(courses.map((c) => c.category))).sort();

  const query = q.trim().toLowerCase();
  const filtered = courses.filter(
    (c) =>
      (!category || c.category === category) &&
      (!query ||
        (c.title + " " + c.description).toLowerCase().includes(query))
  );

  return (
    <div className="mx-auto max-w-5xl px-10 py-10">
      <h1 className="text-[26px] font-semibold tracking-tight">
        Browse courses
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Everything available to you — assigned or open to all.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <CategoryChip label="All" href="/browse" active={!category} q={q} />
        {categories.map((cat) => (
          <CategoryChip
            key={cat}
            label={cat}
            href={`/browse?category=${encodeURIComponent(cat)}`}
            active={category === cat}
            q={q}
          />
        ))}
        <form method="get" action="/browse" className="ml-auto">
          {category && <input type="hidden" name="category" value={category} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search courses"
            className="w-56 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[13px] shadow-2xs outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          />
        </form>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
          No courses match. Try a different search or category.
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-4">
          {filtered.map((c) => (
            <CourseCard
              key={c.id}
              course={c}
              completed={courseCompletedCount(c, done)}
              total={courseLessonCount(c)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryChip({
  label,
  href,
  active,
  q,
}: {
  label: string;
  href: string;
  active: boolean;
  q: string;
}) {
  const url = q ? `${href}${href.includes("?") ? "&" : "?"}q=${encodeURIComponent(q)}` : href;
  return (
    <Link
      href={url}
      className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition ${
        active
          ? "border-neutral-950 bg-neutral-950 text-white"
          : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
      }`}
    >
      {label}
    </Link>
  );
}
