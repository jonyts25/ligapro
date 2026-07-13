import Link from "next/link";
import { VenueCard } from "@/components/venues/VenueCard";
import { EmptyState } from "@/components/ui/EmptyState";
import type { VenueListItem } from "@/lib/venues/types";

type VenueListProps = {
  organizationId: string;
  venues: VenueListItem[];
  canManage: boolean;
};

export function VenueList({
  organizationId,
  venues,
  canManage,
}: VenueListProps) {
  if (venues.length === 0) {
    return (
      <EmptyState
        title="Aún no has registrado sedes"
        description="Agrega tu complejo deportivo o unidad para comenzar."
        action={
          canManage ? (
            <Link
              href={`/organizaciones/${organizationId}/sedes/nueva`}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
            >
              Nueva sede
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {venues.map((venue) => (
        <li key={venue.id}>
          <VenueCard organizationId={organizationId} venue={venue} />
        </li>
      ))}
    </ul>
  );
}
