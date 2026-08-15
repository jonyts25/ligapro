import { redactPlayerNameForPublic } from "@/lib/players/redact-name";

export function mapPublicPlayerName(
  fullName: string,
  isYouthCompetition: boolean
): string {
  return isYouthCompetition
    ? redactPlayerNameForPublic(fullName)
    : fullName;
}
