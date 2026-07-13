/**
 * Public site origin for auth redirects and absolute links.
 * Never accept arbitrary URLs from form input.
 *
 * On Railway, `request.url` often reports `http://localhost:$PORT` because
 * Next listens internally. Prefer NEXT_PUBLIC_SITE_URL / forwarded headers.
 */

const LOCAL_FALLBACK = "http://localhost:3000";

const INVALID_HOSTS = new Set(["0.0.0.0", "127.0.0.1", "::1", "localhost"]);

function isInvalidHost(host: string): boolean {
  const hostname = host.split(":")[0]?.toLowerCase() ?? "";
  return INVALID_HOSTS.has(hostname);
}

function originFromConfiguredEnv(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

export function getPublicSiteUrl(): string {
  return originFromConfiguredEnv() ?? LOCAL_FALLBACK;
}

/**
 * Absolute origin for redirects in Route Handlers (OAuth callback, etc.).
 */
export function getRequestPublicOrigin(request: Request): string {
  const configured = originFromConfiguredEnv();
  if (configured) return configured;

  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const forwardedProto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "https";
  if (forwardedHost && !isInvalidHost(forwardedHost)) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const host = request.headers.get("host")?.trim();
  if (host && !isInvalidHost(host)) {
    const proto =
      request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
      (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }

  try {
    const { origin, hostname } = new URL(request.url);
    if (!isInvalidHost(hostname)) return origin;
  } catch {
    // fall through
  }

  return LOCAL_FALLBACK;
}
