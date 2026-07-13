import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { getUserMemberships } from "@/lib/auth/get-user-memberships";
import { roleLabel } from "@/lib/auth/validation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { OrganizationBrand } from "@/components/branding/OrganizationBrand";
import { SignOutButton } from "@/components/layout/SignOutButton";

export default async function SelectOrganizationPage() {
  const user = await requireUser();
  const memberships = await getUserMemberships(user.id);

  if (memberships.length === 0) {
    redirect("/onboarding");
  }

  if (memberships.length === 1) {
    redirect(`/organizaciones/${memberships[0].organizationId}/inicio`);
  }

  return (
    <div className="min-h-dvh bg-background px-4 py-8 text-text-primary sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex justify-end">
          <SignOutButton />
        </div>
        <PageHeader
          title="Seleccionar organización"
          description={`Hola ${user.displayName ?? user.email}. Elige la organización con la que quieres trabajar.`}
        />
        <ul className="grid gap-4 sm:grid-cols-2">
          {memberships.map((membership) => (
            <li key={membership.organizationId}>
              <Card className="flex h-full flex-col gap-4">
                <OrganizationBrand
                  branding={{
                    name: membership.organizationName,
                    shortName: membership.organizationName,
                    logoUrl: null,
                    accentColor: null,
                  }}
                  variant="full"
                />
                <p className="text-sm text-text-secondary">
                  Rol: {roleLabel(membership.role)}
                </p>
                <Link
                  href={`/organizaciones/${membership.organizationId}/inicio`}
                  className="mt-auto inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground hover:opacity-90"
                >
                  Entrar
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
