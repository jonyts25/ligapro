import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { getPlayerCredentialForMatchCapture } from "@/lib/players/queries";
import { PlayerCredentialCard } from "@/components/players/PlayerCredentialCard";

type PageProps = {
  params: Promise<{
    organizationId: string;
    competitionId: string;
    seasonId: string;
    matchId: string;
    seasonTeamPlayerId: string;
  }>;
};

export default async function MatchPlayerCredentialPage({ params }: PageProps) {
  const {
    organizationId,
    competitionId,
    seasonId,
    matchId,
    seasonTeamPlayerId,
  } = await params;
  const user = await requireUser();
  await requireOrganizationMembership(user.id, organizationId);

  const credential = await getPlayerCredentialForMatchCapture(
    organizationId,
    competitionId,
    seasonId,
    matchId,
    seasonTeamPlayerId
  );
  if (!credential) notFound();

  const captureBase = `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}/partidos/${matchId}/captura`;

  return (
    <div className="mx-auto max-w-xl space-y-5 pb-10">
      <Link
        href={captureBase}
        className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium"
      >
        Volver a captura
      </Link>
      <PlayerCredentialCard
        credential={credential}
        pdfDownload={{
          mode: "capture",
          organizationId,
          competitionId,
          seasonId,
          matchId,
          seasonTeamPlayerId,
        }}
      />
    </div>
  );
}
