import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import { getOrganizationFieldDetail } from "@/lib/venues/queries";
import { FieldForm } from "@/components/venues/FieldForm";
import { PageHeader } from "@/components/ui/PageHeader";

type PageProps = {
  params: Promise<{ organizationId: string; fieldId: string }>;
};

export default async function EditFieldPage({ params }: PageProps) {
  const { organizationId, fieldId } = await params;
  const user = await requireUser();
  await requireOrganizationAdmin(user.id, organizationId);

  const field = await getOrganizationFieldDetail(organizationId, fieldId);
  if (!field) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        title="Editar cancha"
        description={field.name}
        actions={
          <Link
            href={`/organizaciones/${organizationId}/canchas/${fieldId}`}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium"
          >
            Volver al detalle
          </Link>
        }
      />
      <FieldForm organizationId={organizationId} mode="edit" field={field} />
    </div>
  );
}
