import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { SeasonDetail } from "@/lib/competitions/types";

type SeasonReadinessCardProps = {
  season: SeasonDetail;
};

export function SeasonReadinessCard({ season }: SeasonReadinessCardProps) {
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

  return (
    <Card className="space-y-4">
      <SectionHeader
        title="Preparación de temporada"
        description="Checklist antes de operar partidos. Los equipos llegan en el siguiente bloque."
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
      {readiness.teamCount === 0 && (
        <StatusBadge label="Pendiente de equipos" variant="warning" />
      )}
      <button
        type="button"
        disabled
        className="inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center rounded-xl border border-border px-4 text-sm font-medium text-muted opacity-70"
        title="Disponible en el siguiente bloque"
      >
        Registrar equipos · Disponible en el siguiente bloque
      </button>
    </Card>
  );
}
