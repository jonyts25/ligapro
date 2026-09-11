import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { getOrganizationFieldDetail } from "@/lib/venues/queries";
import { FieldDetailPanel } from "@/components/venues/FieldDetailPanel";
import { PageHeader } from "@/components/ui/PageHeader";

type PageProps = {
  params: Promise<{ organizationId: string; fieldId: string }>;
};

export default async function FieldDetailPage({ params }: PageProps) {
  const { organizationId, fieldId } = await params;
  const user = await requireUser();
  const membership = await requireOrganizationMembership(
    user.id,
    organizationId
  );
  const canManage =
    membership.role === "organization_owner" ||
    membership.role === "organization_admin";

  const field = await getOrganizationFieldDetail(organizationId, fieldId);
  if (!field) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={field.name}
        description="Disponibilidad semanal y edición de la cancha."
        actions={
          <Link
            href={`/organizaciones/${organizationId}/canchas`}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium"
          >
            Todas las canchas
          </Link>
        }
      />
      <FieldDetailPanel
        organizationId={organizationId}
        field={field}
        canManage={canManage}
      />
    </div>
  );
}
