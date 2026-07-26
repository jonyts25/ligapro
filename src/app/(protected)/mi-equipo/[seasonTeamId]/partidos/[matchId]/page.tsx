import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import {
  getCaptainMatchDetail,
  getCaptainMatchRescheduleRequest,
  getOpponentCaptainPhone,
} from "@/lib/captain/queries";
import { formatMatchDateTime } from "@/lib/fixtures/format";
import { CaptainMatchReschedulePanel } from "@/components/captain/CaptainMatchReschedulePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";

type PageProps = {
  params: Promise<{ seasonTeamId: string; matchId: string }>;
};

export default async function CaptainMatchDetailPage({ params }: PageProps) {
  const { seasonTeamId, matchId } = await params;
  const user = await requireUser();
  const ctx = await getCaptainMatchDetail(user.id, seasonTeamId, matchId);
  if (!ctx) notFound();

  const { team, match } = ctx;
  const [request, opponentPhone] = await Promise.all([
    getCaptainMatchRescheduleRequest(team.organizationId, matchId),
    getOpponentCaptainPhone(user.id, team, match),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${match.isOwnHome ? "vs" : "@"} ${match.opponentName}`}
        description={`${team.competitionName} · ${team.seasonName}`}
        actions={
          <Link
            href={`/mi-equipo/${seasonTeamId}`}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium"
          >
            Volver
          </Link>
        }
      />

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            label={
              match.calendarStatus === "confirmado"
                ? "Confirmado"
                : "Programado"
            }
            variant={
              match.calendarStatus === "confirmado" ? "success" : "default"
            }
          />
        </div>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-text-secondary">Rival</dt>
            <dd>{match.opponentName}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-text-secondary">Local / visitante</dt>
            <dd>{match.isOwnHome ? "Local" : "Visitante"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-text-secondary">Jornada</dt>
            <dd>
              {match.roundNumber ?? "—"}
              {match.legNumber ? ` · Vuelta ${match.legNumber}` : ""}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-text-secondary">Programación</dt>
            <dd>{formatMatchDateTime(match.startsAt)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-text-secondary">Sede / cancha</dt>
            <dd>
              {[match.venueName, match.fieldName].filter(Boolean).join(" · ") ||
                "—"}
            </dd>
          </div>
        </dl>
      </Card>

      <CaptainMatchReschedulePanel
        team={team}
        match={match}
        request={request}
        currentProfileId={user.id}
        opponentCaptainPhone={opponentPhone}
      />
    </div>
  );
}
