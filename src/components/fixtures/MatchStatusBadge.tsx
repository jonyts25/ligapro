"use client";

import { StatusBadge } from "@/components/ui/StatusBadge";
import type { MatchListItem } from "@/lib/fixtures/types";
import { programmingLabel } from "@/lib/fixtures/types";

export function MatchStatusBadge({ match }: { match: MatchListItem }) {
  if (match.status === "cancelled") {
    return <StatusBadge label="Cancelado" variant="warning" />;
  }
  if (match.status === "finished" || match.status === "walkover") {
    return <StatusBadge label="Finalizado" variant="default" />;
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
