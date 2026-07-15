import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { parseGoogleDocUrl } from "@/lib/content";
import { getGoogleAccessToken, exportDocAsPdf } from "@/lib/googleDrive";

function errorPage(title: string, body: string, openUrl?: string) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:90vh;margin:0;background:#fafafa;color:#333}
    .card{max-width:26rem;text-align:center;padding:2rem}
    h1{font-size:1rem;margin:0 0 .5rem}
    p{font-size:.85rem;color:#666;line-height:1.5;margin:0 0 1rem}
    a{color:#c2410c;font-weight:500}
  </style></head><body><div class="card"><h1>${title}</h1><p>${body}</p>${
    openUrl
      ? `<a href="${openUrl}" target="_blank" rel="noopener noreferrer">Open in Google Docs ↗</a>`
      : ""
  }</div></body></html>`;
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return new NextResponse("Not signed in", { status: 401 });

  const { lessonId } = await params;
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      module: { include: { course: { include: { assignments: true } } } },
    },
  });
  if (!lesson?.docUrl) return new NextResponse("Not found", { status: 404 });

  const { course } = lesson.module;
  const open = course.assignments.length === 0;
  const mine = course.assignments.some((a) => a.userId === user.id);
  if (!open && !mine) return new NextResponse("Forbidden", { status: 403 });

  const doc = parseGoogleDocUrl(lesson.docUrl);
  if (!doc?.fileId) return new NextResponse("Not embeddable", { status: 400 });

  const token = await getGoogleAccessToken(user.id);
  if (!token) {
    return errorPage(
      "Reconnect Google to view this document",
      "Your account hasn't granted document access yet. Sign out and sign back in to grant it, or open the doc directly.",
      doc.openUrl
    );
  }

  const upstream = await exportDocAsPdf(token, doc.fileId);
  if (!upstream.ok) {
    const errBody = await upstream.text();

    if (/has not been used in project|SERVICE_DISABLED|accessNotConfigured/.test(errBody)) {
      return errorPage(
        "Google Drive API is not enabled",
        "An admin needs to enable the Google Drive API in the app's Google Cloud project (APIs & Services → Library → Google Drive API → Enable). Until then, use the link below.",
        doc.openUrl
      );
    }
    if (/ACCESS_TOKEN_SCOPE_INSUFFICIENT|insufficient/i.test(errBody)) {
      return errorPage(
        "Reconnect Google to view this document",
        "Your sign-in predates document access. Sign out and sign back in to grant it, or open the doc directly.",
        doc.openUrl
      );
    }
    if (upstream.status === 403 || upstream.status === 404) {
      return errorPage(
        "You don't have access to this document",
        "Your Google account can't open this doc. Ask the course owner to share it with you, then reload this page.",
        doc.openUrl
      );
    }
    return errorPage(
      "Couldn't load the document",
      `Google returned an error (${upstream.status}). Try reloading, or open the doc directly.`,
      doc.openUrl
    );
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=300",
    },
  });
}
