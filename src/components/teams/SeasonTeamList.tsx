import Link from "next/link";
import { SeasonTeamCard } from "@/components/teams/SeasonTeamCard";
import { EmptyState } from "@/components/ui/EmptyState";
import type { SeasonTeamListItem } from "@/lib/teams/types";

type SeasonTeamListProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  seasonTeams: SeasonTeamListItem[];
  canManage: boolean;
};

export function SeasonTeamList({
  organizationId,
  competitionId,
  seasonId,
  seasonTeams,
  canManage,
}: SeasonTeamListProps) {
  if (seasonTeams.length === 0) {
    return (
      <EmptyState
        title="Esta temporada aún no tiene equipos inscritos."
        description="Inscribe equipos de la organización para armar planteles y operar la temporada."
        action={
          canManage ? (
            <Link
              href={`/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}/equipos/inscribir`}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
            >
              Inscribir
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {seasonTeams.map((seasonTeam) => (
        <li key={seasonTeam.id}>
          <SeasonTeamCard
            organizationId={organizationId}
            competitionId={competitionId}
            seasonId={seasonId}
            seasonTeam={seasonTeam}
          />
        </li>
      ))}
    </ul>
  );
}
