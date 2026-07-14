import Link from "next/link";
import { ProgressRing } from "@/components/ProgressBar";

export default function CourseCard({
  course,
  completed,
  total,
}: {
  course: {
    id: string;
    title: string;
    description: string;
    category: string;
    color: string;
  };
  completed: number;
  total: number;
}) {
  const started = completed > 0;
  const done = total > 0 && completed >= total;
  return (
    <Link
      href={`/courses/${course.id}`}
      className="group flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-neutral-300 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: course.color }}
        />
        <span className="mr-auto rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] tracking-[0.14em] text-neutral-600">
          {course.category.toUpperCase()}
        </span>
        <ProgressRing completed={completed} total={total} />
      </div>
      <div>
        <div className="text-[15px] font-semibold tracking-tight text-neutral-900">
          {course.title}
        </div>
        <p className="mt-1 line-clamp-2 text-[13px] text-neutral-500">
          {course.description}
        </p>
      </div>
      <div className="mt-auto flex items-center justify-between pt-1">
        <span className="font-mono text-[11px] text-neutral-500">
          {completed} / {total} lessons
        </span>
        <span className={`text-[13px] font-medium ${done ? "text-pine-700" : "text-brand-700"} group-hover:underline`}>
          {done ? "Review" : started ? "Continue →" : "Start →"}
        </span>
      </div>
    </Link>
  );
}
