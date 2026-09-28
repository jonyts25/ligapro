import { buildLiveMatchdayAlerts } from "@/lib/matches/live-matchday-core";

export const PENDING_ITEMS_MAX_ROWS = 5;

export type PendingMatchSource = {
  matchId: string;
  seasonId: string;
  competitionId: string;
  seasonName: string;
  homeTeamName: string;
  awayTeamName: string;
  startsAt: string | null;
  status: string;
  hasConfirmedReferee: boolean;
  hasOpenDispute: boolean;
  isResultOfficial: boolean;
  matchDurationMinutes: number;
};

export type PendingDisputeSource = {
  disputeId: string;
  matchId: string;
  seasonId: string;
  competitionId: string;
  homeTeamName: string;
  awayTeamName: string;
  reason: string | null;
};

export type PendingFinanceSource = {
  seasonTeamId: string;
  seasonId: string;
  competitionId: string;
  seasonName: string;
  teamName: string;
  balanceDue: number;
};

export type PendingTeamRegistrationRequestSource = {
  requestId: string;
  seasonId: string;
  competitionId: string;
  seasonName: string;
  teamName: string;
  contactName: string;
  contactEmail: string;
};

export type PendingItemRow = {
  id: string;
  label: string;
  detail: string | null;
  href: string;
};

export type PendingItemsCategory = {
  id:
    | "matches_without_referee"
    | "results_not_captured"
    | "results_pending_approval"
    | "open_disputes"
    | "teams_with_balance_due"
    | "pending_team_registration_requests";
  title: string;
  totalCount: number;
  items: PendingItemRow[];
  viewAllHref: string | null;
};

export type OrganizationPendingItems = {
  categories: PendingItemsCategory[];
  allClear: boolean;
};

export function buildMatchDetailHref(
  organizationId: string,
  competitionId: string,
  seasonId: string,
  matchId: string
): string {
  return `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}/partidos/${matchId}`;
}

export function buildMatchCaptureHref(
  organizationId: string,
  competitionId: string,
  seasonId: string,
  matchId: string
): string {
  return `${buildMatchDetailHref(organizationId, competitionId, seasonId, matchId)}/captura`;
}

export function buildSeasonFinanceHref(
  organizationId: string,
  competitionId: string,
  seasonId: string
): string {
  return `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}/finanzas`;
}

export function buildSeasonTeamRegistrationRequestsHref(
  organizationId: string,
  competitionId: string,
  seasonId: string
): string {
  return `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}/inscripciones-equipo`;
}

function matchLabel(match: PendingMatchSource): string {
  return `${match.homeTeamName} vs ${match.awayTeamName}`;
}

function limitCategoryItems<T>(
  rows: T[],
  mapRow: (row: T) => PendingItemRow
): { totalCount: number; items: PendingItemRow[] } {
  return {
    totalCount: rows.length,
    items: rows.slice(0, PENDING_ITEMS_MAX_ROWS).map(mapRow),
  };
}

export function buildMatchesWithoutRefereeCategory(
  organizationId: string,
  matches: PendingMatchSource[],
  windowStartMs: number,
  windowEndMs: number
): PendingItemsCategory {
  const filtered = matches
    .filter((match) => {
      if (match.status !== "scheduled" || match.hasConfirmedReferee) {
        return false;
      }
      const startsMs = match.startsAt ? new Date(match.startsAt).getTime() : NaN;
      return (
        Number.isFinite(startsMs) &&
        startsMs >= windowStartMs &&
        startsMs <= windowEndMs
      );
    })
    .sort((a, b) =>
      (a.startsAt ?? "").localeCompare(b.startsAt ?? "")
    );

  const { totalCount, items } = limitCategoryItems(filtered, (match) => ({
    id: match.matchId,
    label: matchLabel(match),
    detail: match.startsAt
      ? new Date(match.startsAt).toLocaleString("es-MX", {
          dateStyle: "short",
          timeStyle: "short",
          timeZone: "America/Mexico_City",
        })
      : null,
    href: buildMatchDetailHref(
      organizationId,
      match.competitionId,
      match.seasonId,
      match.matchId
    ),
  }));

  return {
    id: "matches_without_referee",
    title: "Partidos sin árbitro confirmado",
    totalCount,
    items,
    viewAllHref:
      totalCount > PENDING_ITEMS_MAX_ROWS
        ? `/organizaciones/${organizationId}/calendario`
        : null,
  };
}

export function buildResultsNotCapturedCategory(
  organizationId: string,
  matches: PendingMatchSource[],
  windowEndMs: number,
  nowMs: number
): PendingItemsCategory {
  const filtered = matches
    .filter((match) => {
      const startsMs = match.startsAt ? new Date(match.startsAt).getTime() : NaN;
      if (!Number.isFinite(startsMs) || startsMs > windowEndMs) {
        return false;
      }

      const alerts = buildLiveMatchdayAlerts({
        startsAt: match.startsAt,
        status: match.status,
        hasConfirmedReferee: match.hasConfirmedReferee,
        hasOpenDispute: match.hasOpenDispute,
        isResultOfficial: match.isResultOfficial,
        homeValidatedCount: 0,
        awayValidatedCount: 0,
        matchDurationMinutes: match.matchDurationMinutes,
        nowMs,
      });

      return alerts.some((alert) => alert.id === "result_not_captured");
    })
    .sort((a, b) =>
      (b.startsAt ?? "").localeCompare(a.startsAt ?? "")
    );

  const { totalCount, items } = limitCategoryItems(filtered, (match) => ({
    id: match.matchId,
    label: matchLabel(match),
    detail: match.seasonName,
    href: buildMatchCaptureHref(
      organizationId,
      match.competitionId,
      match.seasonId,
      match.matchId
    ),
  }));

  return {
    id: "results_not_captured",
    title: "Resultados sin capturar",
    totalCount,
    items,
    viewAllHref:
      totalCount > PENDING_ITEMS_MAX_ROWS
        ? `/organizaciones/${organizationId}/jornada-en-vivo`
        : null,
  };
}

export function buildResultsPendingApprovalCategory(
  organizationId: string,
  matches: PendingMatchSource[]
): PendingItemsCategory {
  const filtered = matches
    .filter(
      (match) =>
        !match.isResultOfficial &&
        !match.hasOpenDispute &&
        (match.status === "finished" || match.status === "walkover")
    )
    .sort((a, b) =>
      (b.startsAt ?? "").localeCompare(a.startsAt ?? "")
    );

  const { totalCount, items } = limitCategoryItems(filtered, (match) => ({
    id: match.matchId,
    label: matchLabel(match),
    detail: match.seasonName,
    href: buildMatchDetailHref(
      organizationId,
      match.competitionId,
      match.seasonId,
      match.matchId
    ),
  }));

  return {
    id: "results_pending_approval",
    title: "Resultados pendientes de aprobar",
    totalCount,
    items,
    viewAllHref: null,
  };
}

export function buildOpenDisputesCategory(
  organizationId: string,
  disputes: PendingDisputeSource[]
): PendingItemsCategory {
  const sorted = [...disputes].sort((a, b) =>
    `${a.homeTeamName}${a.awayTeamName}`.localeCompare(
      `${b.homeTeamName}${b.awayTeamName}`
    )
  );

  const { totalCount, items } = limitCategoryItems(sorted, (dispute) => ({
    id: dispute.disputeId,
    label: `${dispute.homeTeamName} vs ${dispute.awayTeamName}`,
    detail: dispute.reason,
    href: buildMatchDetailHref(
      organizationId,
      dispute.competitionId,
      dispute.seasonId,
      dispute.matchId
    ),
  }));

  return {
    id: "open_disputes",
    title: "Disputas abiertas",
    totalCount,
    items,
    viewAllHref: null,
  };
}

export function buildTeamsWithBalanceDueCategory(
  organizationId: string,
  financeRows: PendingFinanceSource[]
): PendingItemsCategory {
  const sorted = [...financeRows].sort((a, b) => b.balanceDue - a.balanceDue);

  const { totalCount, items } = limitCategoryItems(sorted, (row) => ({
    id: row.seasonTeamId,
    label: row.teamName,
    detail: `${row.seasonName} · ${row.balanceDue.toFixed(2)} MXN pendientes`,
    href: buildSeasonFinanceHref(
      organizationId,
      row.competitionId,
      row.seasonId
    ),
  }));

  return {
    id: "teams_with_balance_due",
    title: "Equipos con pago pendiente",
    totalCount,
    items,
    viewAllHref:
      totalCount > PENDING_ITEMS_MAX_ROWS
        ? `/organizaciones/${organizationId}/finanzas`
        : null,
  };
}

export function buildPendingTeamRegistrationRequestsCategory(
  organizationId: string,
  requests: PendingTeamRegistrationRequestSource[]
): PendingItemsCategory {
  const sorted = [...requests].sort((a, b) =>
    a.teamName.localeCompare(b.teamName)
  );

  const { totalCount, items } = limitCategoryItems(sorted, (row) => ({
    id: row.requestId,
    label: row.teamName,
    detail: `${row.seasonName} · ${row.contactName}`,
    href: buildSeasonTeamRegistrationRequestsHref(
      organizationId,
      row.competitionId,
      row.seasonId
    ),
  }));

  return {
    id: "pending_team_registration_requests",
    title: "Solicitudes de equipo pendientes",
    totalCount,
    items,
    viewAllHref: null,
  };
}

export function buildOrganizationPendingItems(input: {
  organizationId: string;
  matches: PendingMatchSource[];
  disputes: PendingDisputeSource[];
  financeRows: PendingFinanceSource[];
  teamRegistrationRequests?: PendingTeamRegistrationRequestSource[];
  nowMs?: number;
  windowStartMs?: number;
  windowEndMs?: number;
}): OrganizationPendingItems {
  const nowMs = input.nowMs ?? Date.now();
  const windowStartMs = input.windowStartMs ?? nowMs;
  const windowEndMs =
    input.windowEndMs ?? nowMs + 7 * 24 * 60 * 60 * 1000;

  const categories = [
    buildMatchesWithoutRefereeCategory(
      input.organizationId,
      input.matches,
      windowStartMs,
      windowEndMs
    ),
    buildResultsNotCapturedCategory(
      input.organizationId,
      input.matches,
      windowEndMs,
      nowMs
    ),
    buildResultsPendingApprovalCategory(input.organizationId, input.matches),
    buildOpenDisputesCategory(input.organizationId, input.disputes),
    buildTeamsWithBalanceDueCategory(input.organizationId, input.financeRows),
    buildPendingTeamRegistrationRequestsCategory(
      input.organizationId,
      input.teamRegistrationRequests ?? []
    ),
  ];

  return {
    categories,
    allClear: categories.every((category) => category.totalCount === 0),
  };
}
