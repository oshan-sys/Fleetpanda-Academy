import { parseGoogleDocUrl, parseLoomUrl } from "@/lib/content";
import EmbedFrame from "@/components/EmbedFrame";
import QuizPlayer, { type PlayerQuestion } from "@/components/QuizPlayer";

export default function LessonContent({
  lessonId,
  docUrl,
  loomUrl,
  formUrl,
  formResponderUri,
  quiz,
  previousScore,
}: {
  lessonId: string;
  docUrl: string | null;
  loomUrl: string | null;
  formUrl: string | null;
  formResponderUri: string | null;
  quiz: { title: string; totalPoints: number; questions: PlayerQuestion[] } | null;
  previousScore: number | null;
}) {
  const loom = loomUrl ? parseLoomUrl(loomUrl) : null;
  const doc = docUrl ? parseGoogleDocUrl(docUrl) : null;
  const formEmbedSrc = formResponderUri
    ? `${formResponderUri}${formResponderUri.includes("?") ? "&" : "?"}embedded=true`
    : null;
  // Shareable docs are fetched server-side with the viewer's own Google
  // credentials, so restricted docs render for anyone who can open them in
  // Drive. Published (/pub) links embed directly — they're already public.
  const docEmbedSrc = doc?.fileId
    ? `/api/lessons/${lessonId}/doc`
    : doc?.embedUrl;

  if (!loom && !doc && !formUrl) {
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

      {quiz && (
        <QuizPlayer
          lessonId={lessonId}
          title={quiz.title}
          questions={quiz.questions}
          totalPoints={quiz.totalPoints}
          previousScore={previousScore}
        />
      )}

      {formUrl && !quiz && (
        <div>
          {formEmbedSrc ? (
            <>
              <EmbedFrame src={formEmbedSrc} title="Lesson quiz" kind="doc" />
              <a
                href={formResponderUri!}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-[13px] font-medium text-brand-700 hover:underline"
              >
                Open quiz in new tab ↗
              </a>
              <span className="ml-2 text-xs text-neutral-400">
                (use this if the quiz asks you to sign in)
              </span>
            </>
          ) : (
            <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center">
              <div className="text-sm font-semibold">Quiz</div>
              <p className="mx-auto mt-1 max-w-sm text-[13px] text-neutral-500">
                This quiz opens in a new tab.
              </p>
              <a
                href={formUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
              >
                Take the quiz ↗
              </a>
            </div>
          )}
        </div>
      )}

      {doc && (
        <div>
          <EmbedFrame src={docEmbedSrc!} title="Lesson document" kind="doc" />
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
