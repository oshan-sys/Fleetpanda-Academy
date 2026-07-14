"use client";

import { useRef, useState, useTransition } from "react";
import {
  updateCourse,
  deleteCourse,
  createModule,
  updateModule,
  deleteModule,
  reorderModules,
  createLesson,
  updateLesson,
  deleteLesson,
  moveLesson,
  setCourseOpenToEveryone,
  assignUserToCourse,
  unassignUserFromCourse,
  searchUsers,
} from "@/lib/actions/admin";
import { detectContentLink } from "@/lib/content";

interface LessonData {
  id: string;
  title: string;
  type: string;
  docUrl: string | null;
  loomUrl: string | null;
}

interface ModuleData {
  id: string;
  title: string;
  lessons: LessonData[];
}

interface UserLite {
  id: string;
  name: string | null;
  email: string | null;
}

export interface EditorCourse {
  id: string;
  title: string;
  description: string;
  category: string;
  color: string;
  modules: ModuleData[];
  assignedUsers: UserLite[];
}

const COLORS = ["#EA580C", "#0F766E", "#334155", "#7C2D12", "#A16207", "#155E75"];

export default function CourseEditor({ course }: { course: EditorCourse }) {
  const [pending, startTransition] = useTransition();
  const [savedFlash, setSavedFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function save(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
      if (flashTimer.current) clearTimeout(flashTimer.current);
      setSavedFlash(true);
      flashTimer.current = setTimeout(() => setSavedFlash(false), 1600);
    });
  }

  return (
    <div>
      <div className="mt-4 flex items-center justify-between gap-4">
        <h1 className="text-[26px] font-semibold tracking-tight">
          Edit course
        </h1>
        <span
          className={`font-mono text-[11px] ${
            pending
              ? "text-neutral-500"
              : savedFlash
                ? "text-pine-700"
                : "text-transparent"
          }`}
        >
          {pending ? "Saving…" : "Saved ✓"}
        </span>
      </div>

      {/* ---- Course details (autosave on blur) ---- */}
      <section className="mt-5 rounded-xl border border-neutral-200 bg-white p-6">
        <label className="block">
          <span className="text-[12px] font-semibold text-neutral-500">
            Title
          </span>
          <input
            defaultValue={course.title}
            onBlur={(e) => {
              if (e.target.value !== course.title)
                save(() => updateCourse(course.id, { title: e.target.value }));
            }}
            className="mt-1.5 w-full rounded-lg border border-neutral-200 px-3 py-2 text-[15px] font-medium outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          />
        </label>

        <label className="mt-4 block">
          <span className="text-[12px] font-semibold text-neutral-500">
            Description
          </span>
          <textarea
            defaultValue={course.description}
            rows={2}
            onBlur={(e) => {
              if (e.target.value !== course.description)
                save(() =>
                  updateCourse(course.id, { description: e.target.value })
                );
            }}
            className="mt-1.5 w-full resize-y rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          />
        </label>

        <div className="mt-4 flex flex-wrap items-end gap-6">
          <label className="block">
            <span className="text-[12px] font-semibold text-neutral-500">
              Category
            </span>
            <input
              defaultValue={course.category}
              onBlur={(e) => {
                if (e.target.value !== course.category)
                  save(() =>
                    updateCourse(course.id, { category: e.target.value })
                  );
              }}
              className="mt-1.5 w-44 rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
            />
          </label>
          <div>
            <span className="text-[12px] font-semibold text-neutral-500">
              Color
            </span>
            <div className="mt-2 flex items-center gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => save(() => updateCourse(course.id, { color: c }))}
                  className={`h-6 w-6 rounded-full transition ${
                    course.color === c
                      ? "ring-2 ring-neutral-950 ring-offset-2"
                      : "hover:scale-110"
                  }`}
                  style={{ background: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---- Modules & lessons ---- */}
      <ModulesPanel course={course} save={save} />

      {/* ---- Assignments ---- */}
      <AssignmentsPanel course={course} save={save} />

      {/* ---- Danger zone ---- */}
      <section className="mt-6 flex items-center justify-between rounded-xl border border-red-200 bg-red-50/50 p-5">
        <div>
          <div className="text-sm font-semibold text-red-800">
            Delete this course
          </div>
          <div className="text-[13px] text-red-700/70">
            Removes all modules, lessons, and learner progress. No undo.
          </div>
        </div>
        <button
          onClick={() => {
            if (confirm(`Delete "${course.title}" and all its content?`))
              save(() => deleteCourse(course.id));
          }}
          className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
        >
          Delete course
        </button>
      </section>
    </div>
  );
}

// ---------------- Modules ----------------

function ModulesPanel({
  course,
  save,
}: {
  course: EditorCourse;
  save: (fn: () => Promise<unknown>) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const ids = course.modules.map((m) => m.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    ids.splice(from, 1);
    ids.splice(to, 0, dragId);
    save(() => reorderModules(course.id, ids));
  }

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold tracking-tight">
          Modules & lessons
        </h2>
        <button
          onClick={() => save(() => createModule(course.id))}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-[13px] font-medium transition hover:bg-neutral-100"
        >
          + Add module
        </button>
      </div>

      <div className="space-y-4">
        {course.modules.map((mod, mi) => (
          <div
            key={mod.id}
            draggable
            onDragStart={() => setDragId(mod.id)}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setOverId(mod.id);
            }}
            onDrop={() => handleDrop(mod.id)}
            className={`rounded-xl border bg-white transition ${
              overId === mod.id && dragId && dragId !== mod.id
                ? "border-brand-500 ring-2 ring-brand-500/30"
                : "border-neutral-200"
            } ${dragId === mod.id ? "opacity-50" : ""}`}
          >
            <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
              <span
                className="cursor-grab text-neutral-300 hover:text-neutral-500"
                title="Drag to reorder"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="9" cy="5" r="1.6" /><circle cx="15" cy="5" r="1.6" />
                  <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
                  <circle cx="9" cy="19" r="1.6" /><circle cx="15" cy="19" r="1.6" />
                </svg>
              </span>
              <span className="font-mono text-[11px] text-neutral-400">
                {String(mi + 1).padStart(2, "0")}
              </span>
              <input
                defaultValue={mod.title}
                onBlur={(e) => {
                  if (e.target.value !== mod.title)
                    save(() => updateModule(mod.id, { title: e.target.value }));
                }}
                className="min-w-0 flex-1 rounded-md border border-transparent px-2 py-1 text-sm font-semibold outline-none transition hover:border-neutral-200 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
              />
              <button
                onClick={() => save(() => createLesson(mod.id))}
                className="shrink-0 rounded-md px-2 py-1 text-[12px] font-medium text-brand-700 transition hover:bg-brand-50"
              >
                + Lesson
              </button>
              <button
                onClick={() => {
                  if (
                    mod.lessons.length === 0 ||
                    confirm(`Delete module "${mod.title}" and its ${mod.lessons.length} lesson(s)?`)
                  )
                    save(() => deleteModule(mod.id));
                }}
                className="shrink-0 rounded-md p-1.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                title="Delete module"
              >
                <TrashIcon />
              </button>
            </div>

            {mod.lessons.length === 0 ? (
              <div className="px-4 py-3 text-[13px] text-neutral-400">
                No lessons yet.
              </div>
            ) : (
              mod.lessons.map((lesson, li) => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  isFirst={li === 0}
                  isLast={li === mod.lessons.length - 1}
                  save={save}
                />
              ))
            )}
          </div>
        ))}
        {course.modules.length === 0 && (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
            No modules yet — add one to start structuring the course.
          </div>
        )}
      </div>
    </section>
  );
}

// ---------------- Lesson row ----------------

function LessonRow({
  lesson,
  isFirst,
  isLast,
  save,
}: {
  lesson: LessonData;
  isFirst: boolean;
  isLast: boolean;
  save: (fn: () => Promise<unknown>) => void;
}) {
  const [linkInput, setLinkInput] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  function addLink() {
    const parsed = detectContentLink(linkInput);
    if (!parsed) {
      setLinkError("Not a recognized Google Doc or Loom link.");
      return;
    }
    setLinkError(null);
    setLinkInput("");
    if (parsed.kind === "loom") {
      save(() => updateLesson(lesson.id, { loomUrl: parsed.openUrl }));
    } else {
      save(() => updateLesson(lesson.id, { docUrl: parsed.openUrl }));
    }
  }

  return (
    <div className="border-t border-neutral-100 px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="flex flex-col">
          <ArrowButton
            dir="up"
            disabled={isFirst}
            onClick={() => save(() => moveLesson(lesson.id, "up"))}
          />
          <ArrowButton
            dir="down"
            disabled={isLast}
            onClick={() => save(() => moveLesson(lesson.id, "down"))}
          />
        </div>
        <input
          defaultValue={lesson.title}
          onBlur={(e) => {
            if (e.target.value !== lesson.title)
              save(() => updateLesson(lesson.id, { title: e.target.value }));
          }}
          className="min-w-0 flex-1 rounded-md border border-transparent px-2 py-1 text-sm outline-none transition hover:border-neutral-200 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
        />
        <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500">
          {lesson.type === "VIDEO" ? "Video" : lesson.type === "MIXED" ? "Doc + Video" : "Reading"}
        </span>
        <button
          onClick={() => {
            if (confirm(`Delete lesson "${lesson.title}"?`))
              save(() => deleteLesson(lesson.id));
          }}
          className="shrink-0 rounded-md p-1.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
          title="Delete lesson"
        >
          <TrashIcon />
        </button>
      </div>

      <div className="mt-2 ml-8 flex flex-wrap items-center gap-2">
        {lesson.docUrl && (
          <ContentChip
            label="Google Doc"
            onRemove={() => save(() => updateLesson(lesson.id, { docUrl: null }))}
          />
        )}
        {lesson.loomUrl && (
          <ContentChip
            label="Loom video"
            onRemove={() => save(() => updateLesson(lesson.id, { loomUrl: null }))}
          />
        )}
        {(!lesson.docUrl || !lesson.loomUrl) && (
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <input
              value={linkInput}
              onChange={(e) => {
                setLinkInput(e.target.value);
                setLinkError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && addLink()}
              placeholder="Paste a Google Doc or Loom link…"
              className="w-full min-w-40 flex-1 rounded-md border border-neutral-200 px-2.5 py-1.5 text-[12px] outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
            />
            <button
              onClick={addLink}
              disabled={!linkInput.trim()}
              className="shrink-0 rounded-md border border-neutral-300 px-2.5 py-1.5 text-[12px] font-medium transition hover:bg-neutral-100 disabled:opacity-40"
            >
              Add
            </button>
          </div>
        )}
      </div>
      {linkError && (
        <div className="mt-1.5 ml-8 text-[12px] text-red-600">{linkError}</div>
      )}
    </div>
  );
}

// ---------------- Assignments ----------------

function AssignmentsPanel({
  course,
  save,
}: {
  course: EditorCourse;
  save: (fn: () => Promise<unknown>) => void;
}) {
  const restricted = course.assignedUsers.length > 0;
  const [mode, setMode] = useState<"everyone" | "specific">(
    restricted ? "specific" : "everyone"
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    { id: string; name: string | null; email: string | null }[]
  >([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onQueryChange(q: string) {
    setQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      const users = await searchUsers(q);
      setResults(
        users.filter((u) => !course.assignedUsers.some((a) => a.id === u.id))
      );
    }, 250);
  }

  return (
    <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-6">
      <h2 className="text-base font-semibold tracking-tight">Who can see this course</h2>

      <div className="mt-4 space-y-2.5">
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="radio"
            name="visibility"
            checked={mode === "everyone"}
            onChange={() => {
              setMode("everyone");
              if (restricted) save(() => setCourseOpenToEveryone(course.id));
            }}
            className="mt-0.5 accent-brand-600"
          />
          <span>
            <span className="block text-sm font-medium">Everyone</span>
            <span className="block text-[13px] text-neutral-500">
              All learners can browse and take this course.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="radio"
            name="visibility"
            checked={mode === "specific"}
            onChange={() => setMode("specific")}
            className="mt-0.5 accent-brand-600"
          />
          <span>
            <span className="block text-sm font-medium">Specific people</span>
            <span className="block text-[13px] text-neutral-500">
              Only the people you pick below can see it.
            </span>
          </span>
        </label>
      </div>

      {mode === "specific" && (
        <div className="mt-5 border-t border-neutral-100 pt-5">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search people by name or email…"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
            />
            {results.length > 0 && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg">
                {results.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      setQuery("");
                      setResults([]);
                      save(() => assignUserToCourse(course.id, u.id));
                    }}
                    className="flex w-full items-baseline gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-neutral-50"
                  >
                    <span className="font-medium">{u.name ?? "Unnamed"}</span>
                    <span className="text-xs text-neutral-500">{u.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3.5 flex flex-wrap gap-2">
            {course.assignedUsers.map((u) => (
              <span
                key={u.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 py-1 pr-1.5 pl-3 text-[13px]"
              >
                {u.name ?? u.email}
                <button
                  onClick={() =>
                    save(() => unassignUserFromCourse(course.id, u.id))
                  }
                  className="rounded-full p-0.5 text-neutral-400 transition hover:bg-neutral-200 hover:text-neutral-700"
                  title="Remove"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
            {course.assignedUsers.length === 0 && (
              <span className="text-[13px] text-neutral-400">
                Nobody assigned yet — the course stays visible to everyone
                until you add someone.
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------- Small bits ----------------

function ContentChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 py-1 pr-1.5 pl-3 text-[12px] font-medium text-brand-800">
      {label}
      <button
        onClick={onRemove}
        className="rounded-full p-0.5 text-brand-400 transition hover:bg-brand-100 hover:text-brand-800"
        title={`Remove ${label}`}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}

function ArrowButton({
  dir,
  disabled,
  onClick,
}: {
  dir: "up" | "down";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded p-0.5 text-neutral-300 transition hover:text-neutral-600 disabled:opacity-30"
      title={dir === "up" ? "Move up" : "Move down"}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {dir === "up" ? <path d="M18 15l-6-6-6 6" /> : <path d="M6 9l6 6 6-6" />}
      </svg>
    </button>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
