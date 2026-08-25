import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { formatMatchDateTime } from "@/lib/fixtures/format";
import { canConfirmOwnAssignment } from "@/lib/matches/confirm-own-assignment";
import { getMyOfficialMatchAssignments } from "@/lib/matches/my-official-matches";
import {
  MATCH_OFFICIAL_STATUS_OPTIONS,
  officialRoleLabel,
} from "@/lib/matches/types";
import { MyMatchConfirmAttendanceButton } from "@/components/matches/MyMatchConfirmAttendanceButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";

type PageProps = {
  params: Promise<{ organizationId: string }>;
};

function assignmentStatusLabel(status: string): string {
  return (
    MATCH_OFFICIAL_STATUS_OPTIONS.find((option) => option.value === status)
      ?.label ?? status
  );
}

function assignmentStatusVariant(
  status: string
): "success" | "warning" | "danger" | "default" {
  if (status === "confirmed") return "success";
  if (status === "declined") return "danger";
  return "warning";
}

export default async function MyMatchesPage({ params }: PageProps) {
  const { organizationId } = await params;
  const user = await requireUser();
  await requireOrganizationMembership(user.id, organizationId);

  const assignments = await getMyOfficialMatchAssignments(
    organizationId,
    user.id
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Mis partidos"
        description="Partidos donde estás asignado como oficial. Abre captura directamente desde cada fila."
      />

      {!assignments.length ? (
        <EmptyState
          title="Sin partidos asignados"
          description="Cuando te designen árbitro, delegado u otro rol en un partido de temporadas activas, aparecerán aquí con enlace a captura."
        />
      ) : (
        <ul className="space-y-3">
          {assignments.map((assignment) => (
            <li key={`${assignment.matchId}-${assignment.officialRole}`}>
              <Card className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium text-text-primary">
                      {assignment.matchupLabel}
                    </p>
                    <p className="text-sm text-text-secondary">
                      {assignment.competitionName} · {assignment.seasonName}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canConfirmOwnAssignment(assignment.assignmentStatus) && (
                      <MyMatchConfirmAttendanceButton
                        organizationId={organizationId}
                        competitionId={assignment.competitionId}
                        seasonId={assignment.seasonId}
                        matchId={assignment.matchId}
                        matchOfficialId={assignment.matchOfficialId}
                      />
                    )}
                    <Link
                      href={assignment.captureHref}
                      className="inline-flex min-h-11 shrink-0 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
                    >
                      Capturar
                    </Link>
                  </div>
                </div>

                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-text-secondary">Fecha y hora</dt>
                    <dd>{formatMatchDateTime(assignment.startsAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">Sede / cancha</dt>
                    <dd>{assignment.venueFieldLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">Tu rol</dt>
                    <dd>
                      <StatusBadge
                        label={officialRoleLabel(assignment.officialRole)}
                        variant="info"
                      />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">Asignación</dt>
                    <dd>
                      <StatusBadge
                        label={assignmentStatusLabel(
                          assignment.assignmentStatus
                        )}
                        variant={assignmentStatusVariant(
                          assignment.assignmentStatus
                        )}
                      />
                    </dd>
                  </div>
                </dl>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
