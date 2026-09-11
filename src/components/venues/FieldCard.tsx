import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  fieldCardStatusLabel,
  type OrganizationFieldCard,
} from "@/lib/venues/field-cards";

type FieldCardProps = {
  organizationId: string;
  field: OrganizationFieldCard;
};

export function FieldCard({ organizationId, field }: FieldCardProps) {
  const detailHref = `/organizaciones/${organizationId}/sedes/${field.venueId}`;

  return (
    <Link href={detailHref} className="block h-full">
      <Card className="flex h-full flex-col gap-3 transition hover:border-brand/40">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-text-primary">{field.fieldName}</h3>
            {field.surfaceType && (
              <p className="text-sm text-text-secondary">{field.surfaceType}</p>
            )}
          </div>
          <StatusBadge
            label={field.isActive ? "Activa" : "Inactiva"}
            variant={field.isActive ? "success" : "warning"}
          />
        </div>
        <StatusBadge
          label={fieldCardStatusLabel(field)}
          variant={field.hasWeeklyAvailability ? "info" : "default"}
        />
      </Card>
    </Link>
  );
}
