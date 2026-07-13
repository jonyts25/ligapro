import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Card } from "@/components/ui/Card";
import type { VenueListItem } from "@/lib/venues/types";

type VenueCardProps = {
  organizationId: string;
  venue: VenueListItem;
};

export function VenueCard({ organizationId, venue }: VenueCardProps) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-text-primary">
            {venue.name}
          </h3>
          {venue.address ? (
            <p className="mt-1 truncate text-sm text-text-secondary">
              {venue.address}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted">Sin dirección</p>
          )}
        </div>
        <StatusBadge
          label={venue.is_active ? "Activa" : "Inactiva"}
          variant={venue.is_active ? "success" : "warning"}
        />
      </div>
      <p className="text-sm text-text-secondary">
        {venue.fieldCount === 1
          ? "1 cancha"
          : `${venue.fieldCount} canchas`}
      </p>
      <Link
        href={`/organizaciones/${organizationId}/sedes/${venue.id}`}
        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium text-organization-accent hover:bg-surface-elevated"
      >
        Ver sede
      </Link>
    </Card>
  );
}
