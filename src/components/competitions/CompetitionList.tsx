import Link from "next/link";
import { CompetitionCard } from "@/components/competitions/CompetitionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import type { CompetitionListItem } from "@/lib/competitions/types";

type CompetitionListProps = {
  organizationId: string;
  competitions: CompetitionListItem[];
  canManage: boolean;
};

export function CompetitionList({
  organizationId,
  competitions,
  canManage,
}: CompetitionListProps) {
  if (competitions.length === 0) {
    return (
      <EmptyState
        title="Aún no has creado torneos"
        description="Crea tu primera competencia para configurar una temporada."
        action={
          canManage ? (
            <Link
              href={`/organizaciones/${organizationId}/torneos/nuevo`}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
            >
              Nuevo torneo
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {competitions.map((competition) => (
        <li key={competition.id}>
          <CompetitionCard
            organizationId={organizationId}
            competition={competition}
          />
        </li>
      ))}
    </ul>
  );
}
