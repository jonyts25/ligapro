import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  displaySeasonTeamName,
  seasonTeamStatusLabel,
  seasonTeamStatusVariant,
  type SeasonTeamDetail,
} from "@/lib/teams/types";

type SeasonRosterSummaryProps = {
  seasonTeam: SeasonTeamDetail;
};

export function SeasonRosterSummary({ seasonTeam }: SeasonRosterSummaryProps) {
  const displayName = displaySeasonTeamName(
    seasonTeam.display_name,
    seasonTeam.teamName
  );
  const activeLabel =
    seasonTeam.activePlayerCount === 1
      ? "1 jugador activo"
      : `${seasonTeam.activePlayerCount} jugadores activos`;
  const totalLabel =
    seasonTeam.roster.length === 1
      ? "1 en plantel"
      : `${seasonTeam.roster.length} en plantel`;

  const rows = [
    { label: "Torneo", value: seasonTeam.competitionName },
    { label: "Temporada", value: seasonTeam.seasonName },
    { label: "Equipo", value: displayName },
    { label: "Jugadores activos", value: activeLabel },
    { label: "Total en plantel", value: totalLabel },
    {
      label: "Capitán",
      value: seasonTeam.captainName ?? "Sin asignar",
    },
    ...(seasonTeam.group_name?.trim()
      ? [{ label: "Grupo", value: seasonTeam.group_name }]
      : []),
  ];

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeader
          title="Resumen del plantel"
          description="Participación del equipo en esta temporada."
          className="mb-0"
        />
        <StatusBadge
          label={seasonTeamStatusLabel(seasonTeam.registration_status)}
          variant={seasonTeamStatusVariant(seasonTeam.registration_status)}
        />
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-xs uppercase tracking-wide text-muted">
              {row.label}
            </dt>
            <dd className="mt-1 text-sm font-medium text-text-primary">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
