import Link from "next/link";
import { PublicSeasonShell } from "@/components/public-season/PublicSeasonShell";
import { PublicTeamRegistrationForm } from "@/components/public-season/PublicTeamRegistrationForm";
import { getPublicSeasonOverview } from "@/lib/public-season/queries";
import { isPublicTeamRegistrationOpen } from "@/lib/public-season/registration";
import { Card } from "@/components/ui/Card";

type PageProps = {
  params: Promise<{
    organizationId: string;
    seasonSlug: string;
  }>;
};

export default async function PublicTeamRegistrationPage({ params }: PageProps) {
  const { organizationId, seasonSlug } = await params;
  const overview = await getPublicSeasonOverview(organizationId, seasonSlug);
  if (!overview) return null;

  const registrationOpen = await isPublicTeamRegistrationOpen(
    organizationId,
    seasonSlug
  );

  const baseHref = `/publico/${organizationId}/${seasonSlug}`;

  return (
    <PublicSeasonShell
      organizationId={organizationId}
      seasonSlug={seasonSlug}
      active="inicio"
      formatType={overview.formatType}
    >
      {registrationOpen ? (
        <PublicTeamRegistrationForm
          organizationId={organizationId}
          seasonSlug={seasonSlug}
        />
      ) : (
        <Card className="space-y-3">
          <h1 className="text-lg font-semibold">Registro no disponible</h1>
          <p className="text-sm text-text-secondary">
            Este torneo no acepta solicitudes de inscripción en línea en este
            momento.
          </p>
          <Link
            href={baseHref}
            className="inline-flex min-h-11 items-center text-sm font-medium text-organization-accent"
          >
            Volver al torneo
          </Link>
        </Card>
      )}
    </PublicSeasonShell>
  );
}
