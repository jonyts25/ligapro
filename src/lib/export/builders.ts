import {
  getSeasonDisciplineSummary,
  getSeasonStandings,
  getSeasonTopScorers,
} from "@/lib/standings/queries";
import {
  seasonTeamStatusLabel,
  suspensionStatusLabel,
} from "@/lib/standings/types";
import { rosterStatusLabel } from "@/lib/teams/types";
import { playerVerificationLabel } from "@/lib/players/constants";
import { buildCsv } from "@/lib/export/csv";
import { buildTablePdf } from "@/lib/export/pdf-table";
import type { SeasonExportContext } from "@/lib/export/auth";
import type { assertRosterExportAccess } from "@/lib/export/auth";

type RosterExportContext = Awaited<ReturnType<typeof assertRosterExportAccess>>;

export async function buildStandingsCsv(ctx: SeasonExportContext) {
  const rows = await getSeasonStandings(ctx.seasonId);
  return buildCsv(
    ["Pos", "Equipo", "Estado", "PJ", "G", "E", "P", "GF", "GC", "DG", "Pts", "Forma"],
    rows.map((r) => [
      r.position,
      r.teamName,
      seasonTeamStatusLabel(r.registrationStatus),
      r.played,
      r.won,
      r.drawn,
      r.lost,
      r.goalsFor,
      r.goalsAgainst,
      r.goalDifference,
      r.points,
      r.recentForm,
    ])
  );
}

export async function buildStandingsPdf(ctx: SeasonExportContext) {
  const rows = await getSeasonStandings(ctx.seasonId);
  return buildTablePdf({
    title: "Tabla de posiciones",
    subtitle: `${ctx.organizationName} · ${ctx.competitionName} · ${ctx.seasonName}`,
    headers: ["Pos", "Equipo", "PJ", "G", "E", "P", "GF", "GC", "DG", "Pts"],
    rows: rows.map((r) => [
      r.position,
      r.teamName,
      r.played,
      r.won,
      r.drawn,
      r.lost,
      r.goalsFor,
      r.goalsAgainst,
      r.goalDifference,
      r.points,
    ]),
  });
}

export async function buildScorersCsv(ctx: SeasonExportContext) {
  const rows = await getSeasonTopScorers(ctx.seasonId);
  return buildCsv(
    ["Pos", "Jugador", "Equipo", "Goles"],
    rows.map((r) => [r.position, r.playerName, r.teamName, r.goals])
  );
}

export async function buildScorersPdf(ctx: SeasonExportContext) {
  const rows = await getSeasonTopScorers(ctx.seasonId);
  return buildTablePdf({
    title: "Goleadores",
    subtitle: `${ctx.organizationName} · ${ctx.competitionName} · ${ctx.seasonName}`,
    headers: ["Pos", "Jugador", "Equipo", "Goles"],
    rows: rows.map((r) => [r.position, r.playerName, r.teamName, r.goals]),
  });
}

export async function buildDisciplineCsv(ctx: SeasonExportContext) {
  const rows = await getSeasonDisciplineSummary(ctx.seasonId);
  return buildCsv(
    [
      "Jugador",
      "Equipo",
      "Amarillas",
      "Rojas",
      "Suspensiones activas",
      "Partidos pendientes",
      "Estado suspensión",
    ],
    rows.map((r) => [
      r.playerName,
      r.teamName,
      r.yellowCards,
      r.redCards,
      r.activeSuspensions,
      r.matchesRemaining,
      suspensionStatusLabel(r.suspensionStatus),
    ])
  );
}

export async function buildDisciplinePdf(ctx: SeasonExportContext) {
  const rows = await getSeasonDisciplineSummary(ctx.seasonId);
  return buildTablePdf({
    title: "Disciplina",
    subtitle: `${ctx.organizationName} · ${ctx.competitionName} · ${ctx.seasonName}`,
    headers: ["Jugador", "Equipo", "TA", "TR", "Susp.", "Pend.", "Estado"],
    rows: rows.map((r) => [
      r.playerName,
      r.teamName,
      r.yellowCards,
      r.redCards,
      r.activeSuspensions,
      r.matchesRemaining,
      suspensionStatusLabel(r.suspensionStatus),
    ]),
  });
}

export function buildRosterCsv(ctx: RosterExportContext) {
  const headers = ctx.requirePlayerVerification
    ? ["Nombre", "Dorsal", "Estado plantel", "Verificación", "Capitán", "Subcapitán"]
    : ["Nombre", "Dorsal", "Estado plantel", "Capitán", "Subcapitán"];

  return buildCsv(
    headers,
    ctx.roster.map((r) => {
      const base = [
        r.fullName,
        r.jerseyNumber ?? "",
        rosterStatusLabel(r.registrationStatus),
      ];
      if (ctx.requirePlayerVerification) {
        base.push(playerVerificationLabel(r.verificationStatus));
      }
      base.push(r.isCaptain ? "Sí" : "No", r.isViceCaptain ? "Sí" : "No");
      return base;
    })
  );
}

export function buildRosterPdf(ctx: RosterExportContext) {
  const headers = ctx.requirePlayerVerification
    ? ["Nombre", "Dorsal", "Estado", "Verificación"]
    : ["Nombre", "Dorsal", "Estado"];

  const rows = ctx.roster.map((r) => {
    const base = [
      r.fullName,
      r.jerseyNumber ?? "—",
      rosterStatusLabel(r.registrationStatus),
    ];
    if (ctx.requirePlayerVerification) {
      base.push(playerVerificationLabel(r.verificationStatus));
    }
    return base;
  });

  return buildTablePdf({
    title: `Plantel — ${ctx.teamName}`,
    subtitle: `${ctx.organizationName} · ${ctx.competitionName} · ${ctx.seasonName}`,
    headers,
    rows,
  });
}
