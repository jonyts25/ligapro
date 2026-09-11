import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import { FieldForm } from "@/components/venues/FieldForm";
import { PageHeader } from "@/components/ui/PageHeader";

type PageProps = {
  params: Promise<{ organizationId: string }>;
};

export default async function NewFieldPage({ params }: PageProps) {
  const { organizationId } = await params;
  const user = await requireUser();
  await requireOrganizationAdmin(user.id, organizationId);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        title="Nueva cancha"
        description="Registra una cancha directamente en tu organización."
        actions={
          <Link
            href={`/organizaciones/${organizationId}/canchas`}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium"
          >
            Volver
          </Link>
        }
      />
      <FieldForm organizationId={organizationId} mode="create" />
    </div>
  );
}
