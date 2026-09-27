/** Pure helper — safe for web and mobile (no Next.js / path aliases). */
export function isSeasonArchived(visibility: string): boolean {
  return visibility === "archived";
}
