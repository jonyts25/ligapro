/**
 * Public site origin for auth redirects and absolute links.
 * Never accept arbitrary URLs from form input.
 */

const LOCAL_FALLBACK = "http://localhost:3000";

export function getPublicSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return LOCAL_FALLBACK;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return LOCAL_FALLBACK;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return LOCAL_FALLBACK;
  }

  // Strip trailing slash; keep origin only (no path/query).
  return parsed.origin;
}
