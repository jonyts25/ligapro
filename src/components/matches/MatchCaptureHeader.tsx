import { TeamMatchupTitle } from "@/components/teams/TeamMatchupTitle";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { matchStatusLabel } from "@/lib/matches/types";
import { formatMatchDateTime } from "@/lib/fixtures/format";
import type { MatchSchedulingDetails } from "@/lib/fixtures/types";
import type { MatchCapturePermissions } from "@/lib/matches/types";

type MatchCaptureHeaderProps = {
  details: MatchSchedulingDetails;
  permissions: MatchCapturePermissions;
};

export function MatchCaptureHeader({
  details,
  permissions,
}: MatchCaptureHeaderProps) {
  const { match } = details;
  return (
    <header className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge
          label={matchStatusLabel(match.status)}
          variant={
            match.status === "finished"
              ? "success"
              : match.status === "in_progress"
                ? "info"
                : "warning"
          }
        />
        <StatusBadge
          label={permissions.actorLabel}
          variant="default"
        />
      </div>
      <div>
        <p className="text-xs text-text-secondary">
          {details.competitionName} · {details.seasonName}
          {match.roundNumber != null ? ` · Jornada ${match.roundNumber}` : ""}
          {match.legNumber ? ` · Vuelta ${match.legNumber}` : ""}
        </p>
        <TeamMatchupTitle
          as="h1"
          titleClassName="mt-1 text-xl"
          homeName={match.homeName}
          awayName={match.awayName}
          homeLogoUrl={match.homeLogoUrl}
          awayLogoUrl={match.awayLogoUrl}
          homeScore={match.homeScore}
          awayScore={match.awayScore}
        />
      </div>
      <p className="text-sm text-text-secondary">
        {formatMatchDateTime(match.schedule.startsAt)}
        {(match.schedule.venueName || match.schedule.fieldName) &&
          ` · ${[match.schedule.venueName, match.schedule.fieldName]
            .filter(Boolean)
            .join(" · ")}`}
      </p>
    </header>
  );
}
