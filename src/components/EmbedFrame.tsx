"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Iframe wrapper with a fullscreen toggle. `kind="video"` keeps a 16:9
 * aspect ratio; `kind="doc"` uses a tall fixed height.
 */
export default function EmbedFrame({
  src,
  title,
  kind,
}: {
  src: string;
  title: string;
  kind: "doc" | "video";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () =>
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function toggleFullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await containerRef.current?.requestFullscreen();
    }
  }

  const frameClass =
    kind === "video"
      ? isFullscreen
        ? "h-full w-full"
        : "absolute inset-0 h-full w-full"
      : isFullscreen
        ? "h-full w-full"
        : "h-[75vh] w-full";

  return (
    <div
      ref={containerRef}
      className={`group relative overflow-hidden rounded-xl border border-neutral-200 ${
        kind === "video" ? "bg-neutral-900" : "bg-white"
      } ${isFullscreen ? "flex flex-col rounded-none border-0" : ""}`}
    >
      {kind === "video" && !isFullscreen ? (
        <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
          <iframe
            src={src}
            title={title}
            allowFullScreen
            className={frameClass}
          />
        </div>
      ) : (
        <iframe src={src} title={title} allowFullScreen className={frameClass} />
      )}

      <button
        onClick={toggleFullscreen}
        title={isFullscreen ? "Exit full screen (Esc)" : "Full screen"}
        className={`absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium shadow-sm backdrop-blur transition ${
          kind === "video"
            ? "bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-black/70"
            : "border border-neutral-200 bg-white/90 text-neutral-700 hover:bg-neutral-100"
        }`}
      >
        {isFullscreen ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3v3a2 2 0 0 1-2 2H3" />
            <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
            <path d="M3 16h3a2 2 0 0 1 2 2v3" />
            <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3" />
            <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
            <path d="M3 16v3a2 2 0 0 0 2 2h3" />
            <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
        )}
        {isFullscreen ? "Exit" : "Full screen"}
      </button>
    </div>
  );
}
