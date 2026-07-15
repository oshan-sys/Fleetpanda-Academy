import { prisma } from "@/lib/prisma";

/**
 * Returns a valid Google access token for the user, refreshing (and
 * persisting) it if expired. Returns null when the user has no linked
 * Google account or no usable token (e.g. signed in before the Drive
 * scope was added and never re-consented).
 */
export async function getGoogleAccessToken(
  userId: string
): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
  });
  if (!account?.access_token) return null;

  const expiresAt = (account.expires_at ?? 0) * 1000;
  const stillValid = expiresAt - Date.now() > 60_000;
  if (stillValid) return account.access_token;

  if (!account.refresh_token) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID ?? "",
      client_secret: process.env.AUTH_GOOGLE_SECRET ?? "",
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
    }),
  });
  if (!res.ok) return null;

  const data: {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  } = await res.json();

  await prisma.account.update({
    where: { id: account.id },
    data: {
      access_token: data.access_token,
      expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
      refresh_token: data.refresh_token ?? account.refresh_token,
    },
  });

  return data.access_token;
}

/**
 * Exports a Google Doc as PDF using the viewer's own credentials.
 * Returns the upstream response (streamable) or an error marker.
 */
export async function exportDocAsPdf(
  accessToken: string,
  fileId: string
): Promise<Response> {
  return fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=application/pdf`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
}
