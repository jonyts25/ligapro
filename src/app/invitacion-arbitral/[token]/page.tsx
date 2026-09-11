import { getGuestMatchCaptureContext } from "@/lib/matches/guest-queries";
import { GuestOfficialNameForm } from "@/components/matches/GuestOfficialNameForm";
import { CapturePermissionBadge } from "@/components/matches/CapturePermissionBadge";
import { CaptureWindowStatus } from "@/components/matches/CaptureWindowStatus";
import { MatchScoreForm } from "@/components/matches/MatchScoreForm";
import { MatchEventForm } from "@/components/matches/MatchEventForm";
import { MatchTimeline } from "@/components/matches/MatchTimeline";
import { Card } from "@/components/ui/Card";
type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function GuestOfficialInvitationPage({ params }: PageProps) {
  const { token } = await params;
  const result = await getGuestMatchCaptureContext(token);

  if (!result.ok) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
        <Card className="w-full max-w-md space-y-2">
          <h1 className="text-lg font-semibold">Invitación arbitral</h1>
          <p className="text-sm text-danger">{result.message}</p>
        </Card>
      </div>
    );
  }

  const { context } = result;
  const { invite, snapshot, permissions, timeline, roster } = context;
  const matchClosed =
    snapshot.status === "finished" ||
    snapshot.status === "cancelled" ||
    snapshot.status === "walkover";

  if (context.needsName) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-md">
          <GuestOfficialNameForm inviteToken={token} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-5 px-4 py-8 pb-10">
      <Card className="space-y-1">
        <h1 className="text-lg font-semibold">Captura arbitral</h1>
        <p className="text-sm text-text-secondary">
          {snapshot.homeName} vs {snapshot.awayName}
        </p>
        <p className="text-xs text-muted">{permissions.actorLabel}</p>
      </Card>

      <CapturePermissionBadge
        canCaptureEvents={permissions.canCaptureEvents}
        canUpdateResult={permissions.canUpdateResult}
      />
      <CaptureWindowStatus
        canCaptureEvents={permissions.canCaptureEvents}
        captureWindowOpen={permissions.captureWindowOpen}
        captureWindowBypass={permissions.captureWindowBypass}
      />

      <MatchScoreForm
        organizationId={invite.organizationId}
        competitionId={invite.competitionId}
        seasonId={invite.seasonId}
        matchId={invite.matchId}
        currentStatus={snapshot.status}
        homeScore={snapshot.homeScore}
        awayScore={snapshot.awayScore}
        homeName={snapshot.homeName}
        awayName={snapshot.awayName}
        canUpdate={permissions.canUpdateResult}
        closeOnlyResultUpdate={permissions.closeOnlyResultUpdate}
        guestInviteToken={token}
      />

      <MatchEventForm
        organizationId={invite.organizationId}
        competitionId={invite.competitionId}
        seasonId={invite.seasonId}
        matchId={invite.matchId}
        homeSeasonTeamId={snapshot.homeSeasonTeamId}
        awaySeasonTeamId={snapshot.awaySeasonTeamId}
        homeName={snapshot.homeName}
        awayName={snapshot.awayName}
        roster={roster}
        canCapture={permissions.canCaptureEvents}
        matchClosed={matchClosed}
        matchStartsAt={snapshot.startsAt}
        guestInviteToken={token}
      />

      <MatchTimeline
        organizationId={invite.organizationId}
        competitionId={invite.competitionId}
        seasonId={invite.seasonId}
        matchId={invite.matchId}
        events={timeline}
        canVoidEvents={false}
      />
    </div>
  );
}
