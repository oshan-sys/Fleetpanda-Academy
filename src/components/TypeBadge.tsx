export default function TypeBadge({ type }: { type: string }) {
  const label =
    type === "QUIZ"
      ? "Quiz"
      : type === "VIDEO"
        ? "Video"
        : type === "MIXED"
          ? "Doc + Video"
          : "Reading";
  return (
    <span
      className={`rounded px-1.5 py-0.5 font-mono text-[10px] tracking-wide ${
        type === "QUIZ"
          ? "bg-brand-50 text-brand-800"
          : "bg-neutral-100 text-neutral-500"
      }`}
    >
      {label}
    </span>
  );
}
