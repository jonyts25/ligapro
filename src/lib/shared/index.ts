/**
 * Lógica compartida web + mobile.
 *
 * Reglas de imports en este árbol:
 * - Solo imports relativos dentro de `shared/` (./foo, ../shared/bar).
 * - O `import type` desde fuera (p. ej. tipos de DB); nunca runtime desde `@/`, `next/*` ni web.
 */
export {
  buildMyOfficialMatchAssignments,
  fetchMyOfficialMatchAssignments,
  type MyOfficialMatchAssignmentCore,
} from "./my-official-match-assignments";
export {
  getPersonContexts,
  mapAdminOrganizationRows,
  mapPlayerTeamRows,
  type PersonAdminOrganization,
  type PersonContexts,
  type PersonPlayerTeam,
} from "./person-contexts";
export {
  buildCaptainWhatsAppLink,
  buildMatchCaptainContactMessage,
  buildPlayerClaimWhatsAppMessage,
} from "./captain-whatsapp";
export {
  fetchCaptainRosterCore,
  fetchCaptainUpcomingMatchesCore,
  fetchOpponentCaptainPhoneCore,
  fetchSeasonTeamSeasonId,
  formatCaptainMatchScore,
  mapCaptainMatchRows,
  mapReservationRows,
  mapSeasonTeamNameRows,
  registrationStatusLabel,
  type CaptainMatchCore,
  type CaptainRosterPlayerCore,
} from "./captain-portal";
export {
  fetchMyPlayerStats,
  mapPlayerStatsRows,
  sumPlayerStatsTotals,
  type PlayerStatsRow,
  type PlayerStatsTotals,
} from "./player-stats";
export {
  duplicateConfirmationMessage,
  normalizePlayerPhoneForSearch,
  shouldPromptDuplicateConfirmation,
  type PotentialDuplicatePlayer,
} from "./player-duplicate-ui";
export { isSeasonArchived } from "./season-visibility";
export {
  buildMatchRosterForCapture,
  fetchMatchRosterEligibilityByPlayer,
  fetchMatchRosterForCapture,
  formatRosterSuspensionAlert,
  mapMatchRosterEligibilityRows,
  type MatchParticipationStatus,
  type MatchRosterCapturePlayer,
  type MatchRosterEligibility,
  type MatchRosterForCapture,
} from "./match-roster-for-capture";
