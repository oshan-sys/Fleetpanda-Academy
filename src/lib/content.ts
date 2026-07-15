// Shared (client + server) helpers for detecting and embedding content links.

export interface LoomContent {
  kind: "loom";
  videoId: string;
  embedUrl: string;
  openUrl: string;
}

export interface DocContent {
  kind: "doc";
  embedUrl: string;
  openUrl: string;
  /** Drive file id — present for shareable /document/d/<id>/ links, which
   * can be fetched server-side with the viewer's own Google credentials. */
  fileId?: string;
}

export function parseLoomUrl(url: string): LoomContent | null {
  const m = url.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/);
  if (!m) return null;
  const videoId = m[1];
  return {
    kind: "loom",
    videoId,
    embedUrl: `https://www.loom.com/embed/${videoId}`,
    openUrl: `https://www.loom.com/share/${videoId}`,
  };
}

export function parseGoogleDocUrl(url: string): DocContent | null {
  if (!/docs\.google\.com/.test(url)) return null;

  // "Published to web" links: /document/d/e/<id>/pub — embed with ?embedded=true
  const pub = url.match(
    /https:\/\/docs\.google\.com\/document\/d\/e\/([^/]+)\/pub/
  );
  if (pub) {
    const base = `https://docs.google.com/document/d/e/${pub[1]}/pub`;
    return { kind: "doc", embedUrl: `${base}?embedded=true`, openUrl: base };
  }

  // Shareable links: /document/d/<id>/(edit|view|...) — embed via /preview
  const doc = url.match(/https:\/\/docs\.google\.com\/document\/d\/([^/]+)/);
  if (doc) {
    const id = doc[1];
    return {
      kind: "doc",
      embedUrl: `https://docs.google.com/document/d/${id}/preview`,
      openUrl: `https://docs.google.com/document/d/${id}/edit`,
      fileId: id,
    };
  }

  return null;
}

export interface FormContent {
  kind: "form";
  /** Real form id — only derivable from edit links; enables API results. */
  formId?: string;
  /** Direct respond/embed URL — only derivable from published links. */
  responderUri?: string;
  openUrl: string;
}

export function parseGoogleFormUrl(url: string): FormContent | null {
  // Published "send" links: /forms/d/e/<pubId>/viewform
  const pub = url.match(
    /https:\/\/docs\.google\.com\/forms\/d\/e\/([^/]+)/
  );
  if (pub) {
    const base = `https://docs.google.com/forms/d/e/${pub[1]}/viewform`;
    return { kind: "form", responderUri: base, openUrl: base };
  }
  // Edit links: /forms/d/<formId>/edit — the id the Forms API understands
  const edit = url.match(/https:\/\/docs\.google\.com\/forms\/d\/([^/]+)/);
  if (edit) {
    return { kind: "form", formId: edit[1], openUrl: url };
  }
  // Short links (forms.gle/...) can't be resolved without a request
  return null;
}

/** Auto-detect what a pasted link is. */
export function detectContentLink(
  url: string
): LoomContent | DocContent | FormContent | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  return (
    parseLoomUrl(trimmed) ??
    parseGoogleFormUrl(trimmed) ??
    parseGoogleDocUrl(trimmed)
  );
}

/** Lesson type derived from which content URLs are present. */
export function lessonTypeFor(
  docUrl: string | null,
  loomUrl: string | null,
  formUrl?: string | null
) {
  if (formUrl) return "QUIZ";
  if (docUrl && loomUrl) return "MIXED";
  if (loomUrl) return "VIDEO";
  return "READING";
}
