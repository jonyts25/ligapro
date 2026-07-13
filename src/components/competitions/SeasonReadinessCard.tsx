import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { SeasonDetail } from "@/lib/competitions/types";

type SeasonReadinessCardProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  season: SeasonDetail;
  canManage?: boolean;
};

export function SeasonReadinessCard({
  organizationId,
  competitionId,
  seasonId,
  season,
  canManage = false,
}: SeasonReadinessCardProps) {
  const { readiness } = season;

  const items = [
    {
      label: "Sedes configuradas",
      value: String(readiness.activeVenues),
      ok: readiness.activeVenues > 0,
    },
    {
      label: "Canchas activas",
      value: String(readiness.effectiveActiveFields),
      ok: readiness.effectiveActiveFields > 0,
    },
    {
      label: "Equipos inscritos",
      value: String(readiness.teamCount),
      ok: readiness.teamCount > 0,
    },
    {
      label: "Jugadores en planteles",
      value: String(readiness.activePlayerCount),
      ok: readiness.activePlayerCount > 0,
    },
    {
      label: "Equipos con capitán",
      value: String(readiness.teamsWithCaptain),
      ok: readiness.teamsWithCaptain > 0,
    },
    {
      label: "Fixture generado",
      value: "No",
      ok: false,
    },
    {
      label: "Partidos programados",
      value: "0",
      ok: false,
    },
  ];

  const equiposHref = `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}/equipos`;

  return (
    <Card className="space-y-4">
      <SectionHeader
        title="Preparación de temporada"
        description="Checklist con datos reales antes de generar fixture."
      />
      <StatusBadge
        label={readiness.preparationLabel}
        variant={
          readiness.preparationLabel === "Lista para generar fixture"
            ? "success"
            : "warning"
        }
      />
      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.label}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="text-text-secondary">{item.label}</span>
            <div className="flex items-center gap-2">
              <span className="font-medium text-text-primary">{item.value}</span>
              <StatusBadge
                label={item.ok ? "Listo" : "Pendiente"}
                variant={item.ok ? "success" : "warning"}
              />
            </div>
          </li>
        ))}
      </ul>
      <Link
        href={equiposHref}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
      >
        {canManage ? "Registrar equipos" : "Ver equipos inscritos"}
      </Link>
    </Card>
  );
}
