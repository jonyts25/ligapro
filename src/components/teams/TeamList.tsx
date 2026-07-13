import Link from "next/link";
import { TeamCard } from "@/components/teams/TeamCard";
import { EmptyState } from "@/components/ui/EmptyState";
import type { TeamListItem } from "@/lib/teams/types";

type TeamListProps = {
  organizationId: string;
  teams: TeamListItem[];
  canManage: boolean;
};

export function TeamList({ organizationId, teams, canManage }: TeamListProps) {
  if (teams.length === 0) {
    return (
      <EmptyState
        title="Aún no has registrado equipos..."
        description="Crea equipos de la organización para inscribirlos en temporadas."
        action={
          canManage ? (
            <Link
              href={`/organizaciones/${organizationId}/equipos/nuevo`}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
            >
              Nuevo equipo
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {teams.map((team) => (
        <li key={team.id}>
          <TeamCard organizationId={organizationId} team={team} />
        </li>
      ))}
    </ul>
  );
}
