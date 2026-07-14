"use client";

import { useTransition } from "react";
import {
  markLessonComplete,
  unmarkLessonComplete,
} from "@/lib/actions/progress";

export default function MarkCompleteButton({
  lessonId,
  isComplete,
}: {
  lessonId: string;
  isComplete: boolean;
}) {
  const [pending, startTransition] = useTransition();

  if (isComplete) {
    return (
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-pine-700">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          Completed
        </span>
        <button
          onClick={() => startTransition(() => unmarkLessonComplete(lessonId))}
          disabled={pending}
          className="text-[13px] text-neutral-400 underline-offset-2 transition hover:text-neutral-600 hover:underline disabled:opacity-50"
        >
          Undo
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => startTransition(() => markLessonComplete(lessonId))}
      disabled={pending}
      className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60"
    >
      {pending ? "Saving…" : "Mark as complete"}
    </button>
  );
}
