import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import {
  getCaptainTeamContext,
  getCaptainUpcomingMatches,
  getCaptainRoster,
} from "@/lib/captain/queries";
import { CaptainUpcomingMatches } from "@/components/captain/CaptainUpcomingMatches";
import { CaptainRosterPanel } from "@/components/captain/CaptainRosterPanel";
import { RosterExportButtons } from "@/components/export/ExportButtons";

type PageProps = {
  params: Promise<{ seasonTeamId: string }>;
};

export default async function CaptainTeamPage({ params }: PageProps) {
  const { seasonTeamId } = await params;
  const user = await requireUser();
  const team = await getCaptainTeamContext(user.id, seasonTeamId);

  if (!team) notFound();

  const [matches, rosterData] = await Promise.all([
    getCaptainUpcomingMatches(user.id, team),
    getCaptainRoster(user.id, team),
  ]);

  return (
    <div className="space-y-6">
      <CaptainUpcomingMatches seasonTeamId={seasonTeamId} matches={matches} />
      <RosterExportButtons
        organizationId={team.organizationId}
        competitionId={team.competitionId}
        seasonId={team.seasonId}
        seasonTeamId={seasonTeamId}
      />
      <CaptainRosterPanel
        seasonTeamId={seasonTeamId}
        roster={rosterData.roster}
        requirePlayerVerification={rosterData.requirePlayerVerification}
        rosterLockedByCaptain={rosterData.rosterLockedByCaptain}
      />
    </div>
  );
}
