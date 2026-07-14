import Link from "next/link";
import {
  CalendarDays,
  MapPin,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import { OrganizationBrand } from "@/components/branding/OrganizationBrand";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ResponsiveTableContainer } from "@/components/ui/ResponsiveTableContainer";
import type { OrganizationBranding } from "@/types/branding";
import type { OrganizationMatchStats } from "@/lib/fixtures/types";
import { formatMatchDateTime } from "@/lib/fixtures/format";
import {
  DEMO_RECENT_ACTIVITY,
  DEMO_STATS,
  DEMO_UPCOMING_MATCHES,
} from "@/features/dashboard/demo-data";

function matchStatusVariant(
  status: (typeof DEMO_UPCOMING_MATCHES)[number]["status"]
) {
  if (status === "live") return "live" as const;
  if (status === "finished") return "finished" as const;
  return "scheduled" as const;
}

type OrganizationDashboardDemoProps = {
  branding: OrganizationBranding;
  organizationId: string;
  stats: {
    activeVenues: number;
    effectiveActiveFields: number;
    totalVenues: number;
    competitions: number;
    seasons: number;
    teams: number;
    seasonEnrollments: number;
  };
  matchStats?: OrganizationMatchStats;
  recentResults?: Array<{
    id: string;
    seasonId: string;
    competitionId: string;
    homeName: string;
    awayName: string;
    homeScore: number | null;
    awayScore: number | null;
    status: string;
    updatedAt: string;
  }>;
  standingsLeader?: {
    seasonId: string;
    competitionId: string;
    seasonName: string;
    competitionName: string;
    teamName: string;
    points: number;
    played: number;
  } | null;
  publicSeasonsCount?: number;
  publicSeasons?: Array<{
    id: string;
    name: string;
    slug: string;
    competitionId: string;
    competitionName: string;
  }>;
  canManage?: boolean;
};

export function OrganizationDashboardDemo({
  branding,
  organizationId,
  stats,
  matchStats,
  recentResults = [],
  standingsLeader = null,
  publicSeasonsCount = 0,
  publicSeasons = [],
  canManage = false,
}: OrganizationDashboardDemoProps) {
  const hasRealMatches = (matchStats?.totalMatches ?? 0) > 0;

  return (
    <>
      <PageHeader
        title="Resumen de la liga"
        description="Panel operativo de tu organización."
      />

      <div className="mb-6 rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
          Organización activa
        </p>
        <OrganizationBrand branding={branding} variant="full" />
      </div>

      <section aria-labelledby="real-stats-heading" className="mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <SectionHeader
            title="Datos reales"
            description="Sedes, torneos, temporadas, equipos y partidos."
          />
          <StatusBadge label="Datos reales" variant="success" />
        </div>
        <h2 id="real-stats-heading" className="sr-only">
          Datos reales
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            label="Torneos"
            value={String(stats.competitions)}
            hint="Competencias configuradas"
            icon={Trophy}
          />
          <StatCard
            label="Temporadas"
            value={String(stats.seasons)}
            hint="Ediciones registradas"
            icon={Trophy}
          />
          <StatCard
            label="Equipos"
            value={String(stats.teams)}
            hint={`${stats.seasonEnrollments} inscripción${stats.seasonEnrollments === 1 ? "" : "es"} en temporadas`}
            icon={Users}
          />
          <StatCard
            label="Sedes activas"
            value={String(stats.activeVenues)}
            hint={`${stats.totalVenues} registradas en total`}
            icon={MapPin}
          />
          <StatCard
            label="Canchas activas"
            value={String(stats.effectiveActiveFields)}
            hint="Activas y en sede activa"
            icon={MapPin}
          />
          <StatCard
            label="Partidos"
            value={String(matchStats?.totalMatches ?? 0)}
            hint={`${matchStats?.scheduledMatches ?? 0} programados · ${Math.max(0, (matchStats?.totalMatches ?? 0) - (matchStats?.scheduledMatches ?? 0))} pendientes de horario`}
            icon={CalendarDays}
          />
        </div>
        {stats.totalVenues === 0 && (
          <div className="mt-4">
            <EmptyState
              title="Configura tus sedes"
              description="Registra tu complejo o unidad y las canchas donde jugarán tus ligas."
              action={
                <Link
                  href={`/organizaciones/${organizationId}/sedes`}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
                >
                  Configurar sedes y canchas
                </Link>
              }
            />
          </div>
        )}
        {stats.competitions === 0 && canManage && (
          <div className="mt-4">
            <EmptyState
              title="Crea tu primer torneo"
              description="Define la competencia y una temporada antes de registrar equipos."
              action={
                <Link
                  href={`/organizaciones/${organizationId}/torneos/nuevo`}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
                >
                  Crear primer torneo
                </Link>
              }
            />
          </div>
        )}
        {stats.teams === 0 && canManage && (
          <div className="mt-4">
            <EmptyState
              title="Registra tu primer equipo"
              description="Crea equipos persistentes para inscribirlos en temporadas."
              action={
                <Link
                  href={`/organizaciones/${organizationId}/equipos/nuevo`}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
                >
                  Registrar primer equipo
                </Link>
              }
            />
          </div>
        )}
      </section>

      <section aria-labelledby="matches-heading" className="mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <SectionHeader
            title="Próximos partidos"
            description={
              hasRealMatches
                ? "Partidos programados con fecha futura."
                : "Partidos ficticios para validar tablas y badges."
            }
          />
          <StatusBadge
            label={hasRealMatches ? "Datos reales" : "Datos de demostración"}
            variant={hasRealMatches ? "success" : "warning"}
          />
        </div>
        <h2 id="matches-heading" className="sr-only">
          Próximos partidos
        </h2>
        {hasRealMatches ? (
          matchStats && matchStats.upcoming.length > 0 ? (
            <ResponsiveTableContainer>
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="bg-surface-elevated text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Partido</th>
                    <th className="px-3 py-2 font-medium">Horario</th>
                    <th className="px-3 py-2 font-medium">Lugar</th>
                  </tr>
                </thead>
                <tbody>
                  {matchStats.upcoming.map((match) => (
                    <tr key={match.id} className="border-t border-border">
                      <td className="px-3 py-3 text-text-primary">
                        <Link
                          href={`/organizaciones/${organizationId}/torneos/${match.competitionId}/temporadas/${match.seasonId}/partidos/${match.id}`}
                          className="underline-offset-2 hover:underline"
                        >
                          {match.homeName} vs {match.awayName}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-text-secondary">
                        {formatMatchDateTime(match.startsAt)}
                      </td>
                      <td className="px-3 py-3 text-text-secondary">
                        {[match.venueName, match.fieldName]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResponsiveTableContainer>
          ) : (
            <EmptyState
              title="Sin próximos partidos programados"
              description="Hay fixture, pero aún no hay partidos con fecha futura."
              action={
                <Link
                  href={`/organizaciones/${organizationId}/calendario`}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
                >
                  Ir al calendario
                </Link>
              }
            />
          )
        ) : (
          <ResponsiveTableContainer>
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="bg-surface-elevated text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Partido</th>
                  <th className="px-3 py-2 font-medium">Horario</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_UPCOMING_MATCHES.map((match) => (
                  <tr key={match.id} className="border-t border-border">
                    <td className="px-3 py-3 text-text-primary">
                      {match.homeTeam} vs {match.awayTeam}
                    </td>
                    <td className="px-3 py-3 text-text-secondary">
                      {match.date} · {match.time}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge
                        label={match.statusLabel}
                        variant={matchStatusVariant(match.status)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTableContainer>
        )}
      </section>

      {hasRealMatches && recentResults.length > 0 && (
        <section aria-labelledby="results-heading" className="mb-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <SectionHeader
              title="Resultados recientes"
              description="Partidos finalizados con marcador oficial."
            />
            <StatusBadge label="Datos reales" variant="success" />
          </div>
          <h2 id="results-heading" className="sr-only">
            Resultados recientes
          </h2>
          <ResponsiveTableContainer>
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="bg-surface-elevated text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Partido</th>
                  <th className="px-3 py-2 font-medium">Marcador</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {recentResults.map((match) => (
                  <tr key={match.id} className="border-t border-border">
                    <td className="px-3 py-3 text-text-primary">
                      <Link
                        href={`/organizaciones/${organizationId}/torneos/${match.competitionId}/temporadas/${match.seasonId}/partidos/${match.id}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {match.homeName} vs {match.awayName}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-text-secondary">
                      {match.homeScore != null && match.awayScore != null
                        ? `${match.homeScore}–${match.awayScore}`
                        : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge label="Finalizado" variant="finished" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTableContainer>
        </section>
      )}

      {(standingsLeader || publicSeasonsCount > 0 || canManage) && (
        <section aria-labelledby="standings-public-heading" className="mb-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <SectionHeader
              title="Tabla y página pública"
              description="Líder de la temporada reciente y temporadas visibles al público."
            />
            <StatusBadge label="Datos reales" variant="success" />
          </div>
          <h2 id="standings-public-heading" className="sr-only">
            Tabla y página pública
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {standingsLeader ? (
              <Card className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  Líder · {standingsLeader.seasonName}
                </p>
                <p className="text-lg font-semibold text-text-primary">
                  {standingsLeader.teamName}
                </p>
                <p className="text-sm text-text-secondary">
                  {standingsLeader.points} pts · {standingsLeader.played} PJ ·{" "}
                  {standingsLeader.competitionName}
                </p>
                <Link
                  href={`/organizaciones/${organizationId}/torneos/${standingsLeader.competitionId}/temporadas/${standingsLeader.seasonId}/posiciones`}
                  className="inline-flex min-h-11 items-center text-sm font-medium text-organization-accent underline-offset-2 hover:underline"
                >
                  Ver posiciones
                </Link>
              </Card>
            ) : (
              <Card className="space-y-2">
                <p className="text-sm font-medium text-text-primary">
                  Sin líder aún
                </p>
                <p className="text-sm text-text-secondary">
                  La tabla aparece cuando hay partidos finalizados con marcador.
                </p>
              </Card>
            )}

            <Card className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Temporadas públicas
              </p>
              <p className="text-2xl font-semibold text-text-primary">
                {publicSeasonsCount}
              </p>
              {publicSeasons.length > 0 ? (
                <ul className="space-y-2">
                  {publicSeasons.map((season) => (
                    <li key={season.id}>
                      <Link
                        href={`/publico/${organizationId}/${season.slug}`}
                        className="text-sm font-medium text-organization-accent underline-offset-2 hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {season.name}
                      </Link>
                      <span className="ml-2 text-xs text-muted">
                        {season.competitionName}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text-secondary">
                  {canManage
                    ? "Marca una temporada como pública para compartir el enlace."
                    : "Aún no hay temporadas públicas."}
                </p>
              )}
              {canManage && publicSeasonsCount === 0 && (
                <Link
                  href={`/organizaciones/${organizationId}/torneos`}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
                >
                  Ir a torneos
                </Link>
              )}
            </Card>
          </div>
        </section>
      )}

      {!hasRealMatches && (
        <section aria-labelledby="stats-heading" className="mb-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <SectionHeader
              title="Datos de demostración"
              description="Adeudos aún no son datos reales."
            />
            <StatusBadge label="Datos de demostración" variant="warning" />
          </div>
          <h2 id="stats-heading" className="sr-only">
            Datos de demostración
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {DEMO_STATS.map((stat, index) => {
              const icons = [CalendarDays, Wallet] as const;
              return (
                <StatCard
                  key={stat.label}
                  label={stat.label}
                  value={stat.value}
                  hint={stat.hint}
                  icon={icons[index]}
                />
              );
            })}
          </div>
        </section>
      )}

      <section aria-labelledby="activity-heading">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <SectionHeader
            title="Actividad reciente"
            description="Eventos de demostración."
          />
          <StatusBadge label="Datos de demostración" variant="warning" />
        </div>
        <h2 id="activity-heading" className="sr-only">
          Actividad reciente
        </h2>
        <ul className="space-y-3">
          {DEMO_RECENT_ACTIVITY.map((item) => (
            <li key={item.id}>
              <Card className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {item.title}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {item.detail}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-muted">{item.time}</p>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
