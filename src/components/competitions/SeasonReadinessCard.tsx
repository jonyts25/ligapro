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

function badgeVariant(
  label: SeasonDetail["readiness"]["preparationLabel"]
): "success" | "warning" | "info" {
  if (label === "Lista para generar fixture" || label === "Calendario listo") {
    return "success";
  }
  if (label === "Programando partidos") return "info";
  return "warning";
}

export function SeasonReadinessCard({
  organizationId,
  competitionId,
  seasonId,
  season,
  canManage = false,
}: SeasonReadinessCardProps) {
  const { readiness } = season;
  const base = `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}`;

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
      value: readiness.fixtureGenerated
        ? `Sí (${readiness.totalMatches})`
        : "No",
      ok: readiness.fixtureGenerated,
    },
    {
      label: "Partidos programados",
      value: `${readiness.scheduledMatches}/${readiness.totalMatches || 0}`,
      ok:
        readiness.fixtureGenerated &&
        readiness.pendingMatches === 0 &&
        readiness.totalMatches > 0,
    },
    {
      label: "Partidos pendientes",
      value: String(readiness.pendingMatches),
      ok: readiness.fixtureGenerated && readiness.pendingMatches === 0,
    },
  ];

  return (
    <Card className="space-y-4">
      <SectionHeader
        title="Preparación de temporada"
        description="Checklist con datos reales del fixture y planteles."
      />
      <StatusBadge
        label={readiness.preparationLabel}
        variant={badgeVariant(readiness.preparationLabel)}
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
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          href={`${base}/equipos`}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium"
        >
          {canManage ? "Registrar equipos" : "Ver equipos"}
        </Link>
        {canManage &&
          !readiness.fixtureGenerated &&
          readiness.teamCount >= 2 && (
            <Link
              href={`${base}/fixture/generar`}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
            >
              Generar fixture
            </Link>
          )}
        {readiness.fixtureGenerated && (
          <Link
            href={`${base}/calendario`}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
          >
            Ver calendario
          </Link>
        )}
        {readiness.fixtureGenerated && (
          <Link
            href={`${base}/posiciones`}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium"
          >
            Ver posiciones
          </Link>
        )}
      </div>
    </Card>
  );
}
