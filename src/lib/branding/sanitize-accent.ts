const ACCENT_RE = /^#[0-9A-F]{6}$/;

export function normalizeAccentColor(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  if (!ACCENT_RE.test(normalized)) return null;
  return normalized;
}

export function sanitizeAccentForCss(
  value: string | null | undefined
): string | null {
  return normalizeAccentColor(value);
}
