import {
  CalendarDays,
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

const STAT_ICONS = [Trophy, Users, CalendarDays, Wallet] as const;

function matchStatusVariant(
  status: (typeof DEMO_UPCOMING_MATCHES)[number]["status"]
) {
  if (status === "live") return "live" as const;
  if (status === "finished") return "finished" as const;
  return "scheduled" as const;
}

type OrganizationDashboardDemoProps = {
  branding: OrganizationBranding;
};

export function OrganizationDashboardDemo({
  branding,
}: OrganizationDashboardDemoProps) {
  return (
    <>
      <PageHeader
        title="Resumen de la liga"
        description="Panel operativo de tu organización. Los indicadores numéricos siguen siendo demostración temporal hasta F2/F3."
        actions={
          <StatusBadge label="Datos de demostración" variant="warning" />
        }
      />

      <div className="mb-6 rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
          Organización activa
        </p>
        <OrganizationBrand branding={branding} variant="full" />
      </div>

      <section aria-labelledby="stats-heading" className="mb-8">
        <SectionHeader
          title="Indicadores"
          description="Métricas de demostración. No representan datos reales de Supabase."
        />
        <h2 id="stats-heading" className="sr-only">
          Indicadores principales
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {DEMO_STATS.map((stat, index) => (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              hint={stat.hint}
              icon={STAT_ICONS[index]}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="matches-heading" className="mb-8">
        <SectionHeader
          title="Próximos partidos"
          description="Partidos ficticios para validar tablas y badges."
        />
        <h2 id="matches-heading" className="sr-only">
          Próximos partidos
        </h2>
        <ResponsiveTableContainer label="Próximos partidos demo">
          <table className="min-w-[640px] w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-elevated text-text-secondary">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Fecha
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Encuentro
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Sede
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {DEMO_UPCOMING_MATCHES.map((match) => (
                <tr
                  key={match.id}
                  className="border-b border-border/70 last:border-b-0"
                >
                  <td className="px-4 py-3 whitespace-nowrap text-text-secondary">
                    <span className="block text-text-primary">{match.date}</span>
                    <span className="text-xs">{match.time}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-text-primary">
                    {match.homeTeam}
                    <span className="mx-2 text-muted">vs</span>
                    {match.awayTeam}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{match.venue}</td>
                  <td className="px-4 py-3">
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

      <section aria-labelledby="activity-heading" className="mb-8">
        <SectionHeader
          title="Actividad reciente"
          description="Eventos de demostración con estados semánticos."
        />
        <h2 id="activity-heading" className="sr-only">
          Actividad reciente
        </h2>
        <ul className="space-y-3">
          {DEMO_RECENT_ACTIVITY.map((item) => (
            <li key={item.id}>
              <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-text-primary">{item.title}</p>
                  <p className="mt-1 text-sm text-text-secondary">{item.detail}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-muted">{item.time}</span>
                  <StatusBadge label={item.statusLabel} variant={item.variant} />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="empty-heading">
        <SectionHeader
          title="Espacio disponible"
          description="Ejemplo de EmptyState reutilizable."
        />
        <h2 id="empty-heading" className="sr-only">
          Espacio disponible
        </h2>
        <EmptyState
          title="Sin reportes pendientes"
          description="Cuando no haya elementos que mostrar, este componente mantiene la interfaz clara."
        />
      </section>
    </>
  );
}
