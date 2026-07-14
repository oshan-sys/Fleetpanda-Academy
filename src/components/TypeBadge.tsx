export default function TypeBadge({ type }: { type: string }) {
  const label =
    type === "VIDEO" ? "Video" : type === "MIXED" ? "Doc + Video" : "Reading";
  return (
    <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-neutral-500">
      {label}
    </span>
  );
}
