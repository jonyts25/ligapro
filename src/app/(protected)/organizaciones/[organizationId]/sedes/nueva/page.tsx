import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import { PageHeader } from "@/components/ui/PageHeader";
import { VenueForm } from "@/components/venues/VenueForm";

type PageProps = {
  params: Promise<{ organizationId: string }>;
};

export default async function NewVenuePage({ params }: PageProps) {
  const { organizationId } = await params;
  const user = await requireUser();
  await requireOrganizationAdmin(user.id, organizationId);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Nueva sede"
        description="Registra tu complejo deportivo o unidad."
        actions={
          <Link
            href={`/organizaciones/${organizationId}/sedes`}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
          >
            Volver
          </Link>
        }
      />
      <VenueForm organizationId={organizationId} mode="create" />
    </div>
  );
}
