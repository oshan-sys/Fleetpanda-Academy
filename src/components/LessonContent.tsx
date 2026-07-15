import { parseGoogleDocUrl, parseLoomUrl } from "@/lib/content";
import EmbedFrame from "@/components/EmbedFrame";

export default function LessonContent({
  docUrl,
  loomUrl,
}: {
  docUrl: string | null;
  loomUrl: string | null;
}) {
  const loom = loomUrl ? parseLoomUrl(loomUrl) : null;
  const doc = docUrl ? parseGoogleDocUrl(docUrl) : null;

  if (!loom && !doc) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
        No content has been added to this lesson yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {loom && (
        <div>
          <EmbedFrame src={loom.embedUrl} title="Lesson video" kind="video" />
          <a
            href={loom.openUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-[13px] font-medium text-brand-700 hover:underline"
          >
            Open in Loom ↗
          </a>
        </div>
      )}

      {doc && (
        <div>
          <EmbedFrame src={doc.embedUrl} title="Lesson document" kind="doc" />
          <a
            href={doc.openUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-[13px] font-medium text-brand-700 hover:underline"
          >
            Open in Google Docs ↗
          </a>
          <span className="ml-2 text-xs text-neutral-400">
            (if the preview doesn&apos;t load, the doc&apos;s sharing settings
            may block embedding)
          </span>
        </div>
      )}
    </div>
  );
}
