export const BRAND_COLOR_PRESETS = [
  "#14B8A6",
  "#0EA5E9",
  "#22C55E",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#64748B",
] as const;

export const ORGANIZATION_LOGO_BUCKET = "organization-logos";
export const ORGANIZATION_LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const ORGANIZATION_LOGO_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export function extensionForMime(mime: string): string | null {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    default:
      return null;
  }
}
