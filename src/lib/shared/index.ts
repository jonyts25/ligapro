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
export { isSeasonArchived } from "./season-visibility";
