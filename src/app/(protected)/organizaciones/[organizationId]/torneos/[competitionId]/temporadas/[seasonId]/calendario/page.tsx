import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { getSeasonDetails } from "@/lib/competitions/queries";
import { canManageActiveSeason } from "@/lib/competitions/season-visibility";
import { getSeasonMatchesGroupedByRound } from "@/lib/fixtures/queries";
import { FixtureRoundCard } from "@/components/fixtures/FixtureRoundCard";
import { MatchdayTabs } from "@/components/fixtures/MatchdayTabs";
import { SeasonFixtureSummary } from "@/components/fixtures/SeasonFixtureSummary";
import { SeasonStandingsNav } from "@/components/standings/SeasonStandingsNav";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/utils/cn";
import { tieneAccesoPremium } from "@/lib/organizations/premium-access";
import {
  getJornadaSummariesForSeason,
  getLatestJornadaSummaryJob,
  jornadaRoundLabel,
} from "@/lib/jornada-summaries/queries";

type PageProps = {
  params: Promise<{
    organizationId: string;
    competitionId: string;
    seasonId: string;
  }>;
  searchParams: Promise<{ jornada?: string; filtro?: string }>;
};

export default async function SeasonCalendarPage({
  params,
  searchParams,
}: PageProps) {
  const { organizationId, competitionId, seasonId } = await params;
  const { jornada, filtro } = await searchParams;
  const user = await requireUser();
  const membership = await requireOrganizationMembership(
    user.id,
    organizationId
  );
  const canManage =
    membership.role === "organization_owner" ||
    membership.role === "organization_admin";

  const [season, data, hasPremium, jornadaSummaries] = await Promise.all([
    getSeasonDetails(organizationId, competitionId, seasonId),
    getSeasonMatchesGroupedByRound(organizationId, competitionId, seasonId),
    tieneAccesoPremium(organizationId),
    getJornadaSummariesForSeason(organizationId, seasonId),
  ]);
  if (!season || !data) notFound();

  const canManageActive = canManageActiveSeason(season, canManage);
  const canCapture = canManageActive;

  const selectedRound =
    jornada && /^\d+$/.test(jornada) ? Number(jornada) : ("all" as const);
  const filter =
    filtro === "pendientes" || filtro === "programadas" ? filtro : "todas";

  let rounds = data.rounds;
  if (selectedRound !== "all") {
    rounds = rounds.filter((r) => r.roundNumber === selectedRound);
  }

  rounds = rounds.map((round) => ({
    ...round,
    matches: round.matches.filter((m) => {
      if (filter === "pendientes") return !m.isProgrammed;
      if (filter === "programadas") return m.isProgrammed;
      return true;
    }),
  }));

  const base = `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}`;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Calendario"
        description={`${data.seasonName} · ${data.competitionName}`}
        actions={
          canManageActive && !data.stats.fixtureGenerated ? (
            <Link
              href={`${base}/fixture/generar`}
              className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
            >
              Generar fixture
            </Link>
          ) : undefined
        }
      />

      <SeasonStandingsNav
        organizationId={organizationId}
        competitionId={competitionId}
        seasonId={seasonId}
        active="calendario"
        canManage={canManage}
        canManageActive={canManageActive}
        formatType={data.formatType}
      />

      <SeasonFixtureSummary stats={data.stats} />

      {!data.stats.fixtureGenerated ? (
        <p className="text-sm text-text-secondary">
          Aún no hay partidos. Genera el fixture para organizar las jornadas.
        </p>
      ) : (
        <>
          <Suspense fallback={null}>
            <MatchdayTabs
              rounds={data.rounds.map((r) => r.roundNumber)}
              selectedRound={selectedRound}
            />
          </Suspense>

          <div className="flex flex-wrap gap-2">
            {(
              [
                ["todas", "Todas"],
                ["pendientes", "Pendientes"],
                ["programadas", "Programadas"],
              ] as const
            ).map(([value, label]) => {
              const params = new URLSearchParams();
              if (selectedRound !== "all") {
                params.set("jornada", String(selectedRound));
              }
              if (value !== "todas") params.set("filtro", value);
              const qs = params.toString();
              return (
                <Link
                  key={value}
                  href={qs ? `${base}/calendario?${qs}` : `${base}/calendario`}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-medium",
                    filter === value
                      ? "border-brand bg-brand text-brand-foreground"
                      : "border-border text-text-secondary"
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </div>

          <div className="space-y-4">
            {await Promise.all(
              rounds.map(async (round) => {
                const roundLabel = jornadaRoundLabel(round.roundNumber);
                const jornadaJob = hasPremium
                  ? await getLatestJornadaSummaryJob(
                      organizationId,
                      seasonId,
                      roundLabel
                    )
                  : null;
                return (
                  <FixtureRoundCard
                    key={round.roundNumber}
                    round={round}
                    organizationId={organizationId}
                    competitionId={competitionId}
                    seasonId={seasonId}
                    canManage={canManageActive}
                    canCapture={canCapture}
                    hasPremium={hasPremium}
                    jornadaSummary={jornadaSummaries.get(roundLabel) ?? null}
                    jornadaJob={jornadaJob}
                  />
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
