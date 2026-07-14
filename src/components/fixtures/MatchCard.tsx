"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { MatchStatusBadge } from "@/components/fixtures/MatchStatusBadge";
import { formatMatchDateTime } from "@/lib/fixtures/format";
import type { MatchListItem } from "@/lib/fixtures/types";

type MatchCardProps = {
  match: MatchListItem;
  href: string;
  scheduleHref?: string;
  canManage?: boolean;
};

export function MatchCard({
  match,
  href,
  scheduleHref,
  canManage = false,
}: MatchCardProps) {
  const inactiveInfra =
    match.isProgrammed &&
    (match.schedule.fieldIsActive === false ||
      match.schedule.venueIsActive === false);

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-text-primary">
            {match.homeName}{" "}
            <span className="font-normal text-muted">vs</span> {match.awayName}
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            {match.roundLabel ??
              (match.roundNumber
                ? `Jornada ${match.roundNumber}`
                : "Sin jornada")}
            {match.legNumber ? ` · Vuelta ${match.legNumber}` : ""}
          </p>
        </div>
        <MatchStatusBadge match={match} />
      </div>

      <div className="space-y-1 text-sm text-text-secondary">
        <p>{formatMatchDateTime(match.schedule.startsAt)}</p>
        {(match.schedule.venueName || match.schedule.fieldName) && (
          <p>
            {[match.schedule.venueName, match.schedule.fieldName]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        {inactiveInfra && (
          <p className="text-warning">
            Advertencia: la sede o cancha ya no está activa. La programación
            histórica se conserva.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={href}
          className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium"
        >
          Ver detalle
        </Link>
        {canManage && scheduleHref && match.status === "scheduled" && (
          <Link
            href={scheduleHref}
            className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
          >
            {match.isProgrammed ? "Reprogramar" : "Programar"}
          </Link>
        )}
      </div>
    </Card>
  );
}
