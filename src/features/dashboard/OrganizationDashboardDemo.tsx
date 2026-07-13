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
  };
};

export function OrganizationDashboardDemo({
  branding,
  organizationId,
  stats,
}: OrganizationDashboardDemoProps) {
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
        <SectionHeader
          title="Infraestructura"
          description="Métricas reales de sedes y canchas."
        />
        <h2 id="real-stats-heading" className="sr-only">
          Infraestructura
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
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
      </section>

      <section aria-labelledby="stats-heading" className="mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <SectionHeader
            title="Indicadores de competencia"
            description="Métricas de demostración. No representan datos reales."
          />
          <StatusBadge label="Datos de demostración" variant="warning" />
        </div>
        <h2 id="stats-heading" className="sr-only">
          Indicadores de demostración
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {DEMO_STATS.map((stat, index) => {
            const icons = [Trophy, Users, CalendarDays, Wallet] as const;
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

      <section aria-labelledby="matches-heading" className="mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <SectionHeader
            title="Próximos partidos"
            description="Partidos ficticios para validar tablas y badges."
          />
          <StatusBadge label="Datos de demostración" variant="warning" />
        </div>
        <h2 id="matches-heading" className="sr-only">
          Próximos partidos
        </h2>
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
      </section>

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
                  <p className="mt-1 text-xs text-text-secondary">{item.detail}</p>
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
