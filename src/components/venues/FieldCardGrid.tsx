import { FieldCard } from "@/components/venues/FieldCard";
import { EmptyState } from "@/components/ui/EmptyState";
import type { OrganizationFieldCard } from "@/lib/venues/field-cards";

type FieldCardGridProps = {
  organizationId: string;
  fields: OrganizationFieldCard[];
};

export function FieldCardGrid({ organizationId, fields }: FieldCardGridProps) {
  if (fields.length === 0) {
    return (
      <EmptyState
        title="Aún no hay canchas"
        description="Registra una sede y agrega tu primera cancha para comenzar."
      />
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {fields.map((field) => (
        <li key={field.fieldId}>
          <FieldCard organizationId={organizationId} field={field} />
        </li>
      ))}
    </ul>
  );
}
