"use client";

import { useState, useTransition } from "react";
import { submitQuiz, type QuizAnswers, type QuizResult } from "@/lib/actions/quiz";

export interface PlayerQuestion {
  id: string;
  title: string;
  type: "RADIO" | "CHECKBOX" | "DROP_DOWN" | "TEXT" | "PARAGRAPH";
  required: boolean;
  options?: string[];
  points: number;
}

export default function QuizPlayer({
  lessonId,
  title,
  questions,
  totalPoints,
  previousScore,
}: {
  lessonId: string;
  title: string;
  questions: PlayerQuestion[];
  totalPoints: number;
  previousScore: number | null;
}) {
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [retaking, setRetaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const showSummary = !retaking && (result !== null || previousScore !== null);
  const displayScore = result?.score ?? previousScore;

  function setAnswer(qid: string, values: string[]) {
    setAnswers((a) => ({ ...a, [qid]: values }));
  }

  function toggleCheckbox(qid: string, value: string) {
    const current = answers[qid] ?? [];
    setAnswer(
      qid,
      current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
    );
  }

  const missingRequired = questions.filter(
    (q) => q.required && !(answers[q.id]?.length && answers[q.id][0] !== "")
  );

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        const r = await submitQuiz(lessonId, answers);
        setResult(r);
        setRetaking(false);
      } catch {
        setError("Couldn't submit the quiz — check your connection and try again.");
      }
    });
  }

  if (showSummary) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center">
        <div className="font-mono text-[11px] tracking-[0.18em] text-neutral-500">
          QUIZ {result ? "SUBMITTED" : "COMPLETED"}
        </div>
        <h3 className="mt-2 text-lg font-semibold tracking-tight">{title}</h3>
        {totalPoints > 0 ? (
          <div
            className={`mt-4 text-4xl font-semibold tracking-tight ${
              displayScore !== null && displayScore >= totalPoints * 0.7
                ? "text-pine-700"
                : "text-brand-700"
            }`}
          >
            {displayScore}
            <span className="text-xl text-neutral-400"> / {totalPoints}</span>
          </div>
        ) : (
          <div className="mt-4 text-sm text-neutral-500">
            Your answers were recorded.
          </div>
        )}
        {result && totalPoints > 0 && (
          <div className="mx-auto mt-4 flex max-w-md flex-wrap justify-center gap-1.5">
            {questions.map((q, i) => {
              const verdict = result.perQuestion[q.id];
              return (
                <span
                  key={q.id}
                  title={q.title}
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold ${
                    verdict === true
                      ? "bg-pine-100 text-pine-800"
                      : verdict === false
                        ? "bg-red-100 text-red-700"
                        : "bg-neutral-100 text-neutral-400"
                  }`}
                >
                  {i + 1}
                </span>
              );
            })}
          </div>
        )}
        <button
          onClick={() => {
            setRetaking(true);
            setResult(null);
            setAnswers({});
          }}
          className="mt-6 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-neutral-100"
        >
          Retake quiz
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-100 px-6 py-4">
        <div className="font-mono text-[11px] tracking-[0.18em] text-neutral-500">
          QUIZ
        </div>
        <h3 className="mt-1 text-[15px] font-semibold tracking-tight">
          {title}
        </h3>
        <div className="mt-0.5 text-xs text-neutral-500">
          {questions.length} questions
          {totalPoints > 0 ? ` · ${totalPoints} points` : ""}
        </div>
      </div>

      <div className="space-y-6 px-6 py-5">
        {questions.map((q, i) => (
          <fieldset key={q.id}>
            <legend className="text-sm font-medium text-neutral-900">
              <span className="mr-1.5 font-mono text-[11px] text-neutral-400">
                {i + 1}.
              </span>
              {q.title}
              {q.required && <span className="ml-1 text-brand-600">*</span>}
              {q.points > 0 && (
                <span className="ml-2 font-mono text-[10px] text-neutral-400">
                  {q.points} {q.points === 1 ? "pt" : "pts"}
                </span>
              )}
            </legend>

            <div className="mt-2.5 space-y-1.5">
              {(q.type === "RADIO" || q.type === "DROP_DOWN") &&
                q.options?.map((opt) => (
                  <label
                    key={opt}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm transition ${
                      answers[q.id]?.[0] === opt
                        ? "border-brand-600 bg-brand-50"
                        : "border-neutral-200 hover:border-neutral-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      checked={answers[q.id]?.[0] === opt}
                      onChange={() => setAnswer(q.id, [opt])}
                      className="accent-brand-600"
                    />
                    {opt}
                  </label>
                ))}

              {q.type === "CHECKBOX" &&
                q.options?.map((opt) => (
                  <label
                    key={opt}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm transition ${
                      answers[q.id]?.includes(opt)
                        ? "border-brand-600 bg-brand-50"
                        : "border-neutral-200 hover:border-neutral-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={answers[q.id]?.includes(opt) ?? false}
                      onChange={() => toggleCheckbox(q.id, opt)}
                      className="accent-brand-600"
                    />
                    {opt}
                  </label>
                ))}

              {q.type === "TEXT" && (
                <input
                  type="text"
                  value={answers[q.id]?.[0] ?? ""}
                  onChange={(e) =>
                    setAnswer(q.id, e.target.value ? [e.target.value] : [])
                  }
                  placeholder="Your answer"
                  className="w-full max-w-md rounded-lg border border-neutral-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
                />
              )}

              {q.type === "PARAGRAPH" && (
                <textarea
                  value={answers[q.id]?.[0] ?? ""}
                  onChange={(e) =>
                    setAnswer(q.id, e.target.value ? [e.target.value] : [])
                  }
                  rows={3}
                  placeholder="Your answer"
                  className="w-full resize-y rounded-lg border border-neutral-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
                />
              )}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="flex items-center gap-4 border-t border-neutral-100 px-6 py-4">
        <button
          onClick={handleSubmit}
          disabled={pending || missingRequired.length > 0}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Submitting…" : "Submit quiz"}
        </button>
        {missingRequired.length > 0 && (
          <span className="text-[12px] text-neutral-400">
            {missingRequired.length} required{" "}
            {missingRequired.length === 1 ? "question" : "questions"} left
          </span>
        )}
        {error && <span className="text-[12px] text-red-600">{error}</span>}
      </div>
    </div>
  );
}
