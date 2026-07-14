"use client";

import { StatusBadge } from "@/components/ui/StatusBadge";
import type { MatchListItem } from "@/lib/fixtures/types";
import { programmingLabel } from "@/lib/fixtures/types";
import { matchStatusLabel } from "@/lib/matches/types";

export function MatchStatusBadge({ match }: { match: MatchListItem }) {
  if (match.status === "cancelled") {
    return <StatusBadge label="Cancelado" variant="warning" />;
  }
  if (match.status === "finished" || match.status === "walkover") {
    return (
      <StatusBadge
        label={
          match.homeScore != null && match.awayScore != null
            ? `${matchStatusLabel(match.status)} ${match.homeScore}–${match.awayScore}`
            : matchStatusLabel(match.status)
        }
        variant="success"
      />
    );
  }
  if (match.status === "in_progress") {
    return <StatusBadge label="En curso" variant="info" />;
  }
  return (
    <StatusBadge
      label={programmingLabel(match.isProgrammed)}
      variant={match.isProgrammed ? "success" : "warning"}
    />
  );
}
