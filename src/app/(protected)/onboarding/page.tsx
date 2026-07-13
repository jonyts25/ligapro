import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { getUserMemberships } from "@/lib/auth/get-user-memberships";
import { PageHeader } from "@/components/ui/PageHeader";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { OnboardingForm } from "@/components/organizations/OnboardingForm";

export default async function OnboardingPage() {
  const user = await requireUser();
  const memberships = await getUserMemberships(user.id);

  if (memberships.length === 1) {
    redirect(`/organizaciones/${memberships[0].organizationId}/inicio`);
  }

  if (memberships.length > 1) {
    redirect("/seleccionar-organizacion");
  }

  return (
    <div className="min-h-dvh bg-background px-4 py-8 text-text-primary sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex justify-end">
          <SignOutButton />
        </div>
        <PageHeader
          title="Tu cuenta está lista"
          description="Ahora configuraremos tu organización y tu primera liga."
        />
        <OnboardingForm userLabel={user.displayName ?? user.email ?? "Usuario"} />
      </div>
    </div>
  );
}
