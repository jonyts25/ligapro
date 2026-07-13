/**
 * Client-safe OAuth redirect helpers.
 * Prefer NEXT_PUBLIC_SITE_URL; fall back to the current browser origin.
 */

function resolveAuthOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    try {
      const parsed = new URL(configured);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.origin;
      }
    } catch {
      // fall through
    }
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:3000";
}

export function buildOAuthCallbackUrl(next?: string | null): string {
  const url = new URL("/auth/callback", resolveAuthOrigin());
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    url.searchParams.set("next", next);
  }
  return url.toString();
}
