export const PLAYER_PHOTO_BUCKET = "player-photos";
export const PLAYER_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export const PLAYER_PHOTO_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export {
  extensionForMime,
} from "@/lib/organizations/branding-constants";

export type PlayerVerificationStatus =
  | "not_required"
  | "pending"
  | "approved"
  | "rejected";

export function playerVerificationLabel(status: string): string {
  switch (status) {
    case "approved":
      return "Verificado";
    case "pending":
      return "Verificación pendiente";
    case "rejected":
      return "Verificación rechazada";
    default:
      return "Sin verificación";
  }
}
