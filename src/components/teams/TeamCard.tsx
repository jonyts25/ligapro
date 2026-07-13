import Link from "next/link";
import { Card } from "@/components/ui/Card";
import type { TeamListItem } from "@/lib/teams/types";

type TeamCardProps = {
  organizationId: string;
  team: TeamListItem;
};

export function TeamCard({ organizationId, team }: TeamCardProps) {
  const enrollmentLabel =
    team.seasonEnrollmentCount === 1
      ? "1 inscripción"
      : `${team.seasonEnrollmentCount} inscripciones`;

  return (
    <Card className="flex flex-col gap-3">
      <div className="min-w-0">
        <h3 className="truncate text-base font-semibold text-text-primary">
          {team.name}
        </h3>
        <p className="mt-1 text-sm text-text-secondary">{enrollmentLabel}</p>
      </div>
      {team.latestSeasonName ? (
        <p className="text-sm text-text-secondary">
          Última temporada:{" "}
          <span className="font-medium text-text-primary">
            {team.latestSeasonName}
          </span>
        </p>
      ) : (
        <p className="text-sm text-muted">Sin inscripciones en temporadas</p>
      )}
      <Link
        href={`/organizaciones/${organizationId}/equipos/${team.id}`}
        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium text-organization-accent hover:bg-surface-elevated"
      >
        Ver equipo
      </Link>
    </Card>
  );
}
