export const TEAM_LOGO_BUCKET = "team-logos";
export const TEAM_LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const TEAM_LOGO_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export function extensionForTeamLogoMime(mime: string): string | null {
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
