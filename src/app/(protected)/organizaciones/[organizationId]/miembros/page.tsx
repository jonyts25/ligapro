import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import {
  canManageOrganizationMemberScopes,
  getOrganizationMembersWithScopes,
  getOrganizationSeasonScopeOptions,
} from "@/lib/organization-members/queries";
import { OrganizationMembersPanel } from "@/components/organizations/OrganizationMembersPanel";
import { PageHeader } from "@/components/ui/PageHeader";

type PageProps = {
  params: Promise<{ organizationId: string }>;
};

export default async function OrganizationMembersPage({ params }: PageProps) {
  const { organizationId } = await params;
  const user = await requireUser();
  await requireOrganizationAdmin(user.id, organizationId);

  const [members, seasonOptions, canManageScopes] = await Promise.all([
    getOrganizationMembersWithScopes(organizationId),
    getOrganizationSeasonScopeOptions(organizationId),
    canManageOrganizationMemberScopes(user.id, organizationId),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Miembros"
        description="Roles de la organización y scopes de administrador por temporada."
        actions={
          <Link
            href={`/organizaciones/${organizationId}/configuracion`}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary hover:text-text-primary"
          >
            Configuración
          </Link>
        }
      />
      <OrganizationMembersPanel
        organizationId={organizationId}
        members={members}
        seasonOptions={seasonOptions}
        canManageScopes={canManageScopes}
      />
    </div>
  );
}
