import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { getUserMemberships } from "@/lib/auth/get-user-memberships";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { SignOutButton } from "@/components/layout/SignOutButton";

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
        <Card className="space-y-4">
          <p className="text-sm text-text-secondary">
            Sesión iniciada como{" "}
            <span className="font-medium text-text-primary">
              {user.displayName ?? user.email}
            </span>
            .
          </p>
          <p className="text-sm text-text-secondary">
            En el siguiente bloque podrás crear tu organización, invitar
            colaboradores y comenzar a operar tu liga.
          </p>
          <button
            type="button"
            disabled
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface-elevated px-4 text-sm font-medium text-muted"
          >
            Crear mi organización · Disponible en el siguiente bloque
          </button>
        </Card>
      </div>
    </div>
  );
}
