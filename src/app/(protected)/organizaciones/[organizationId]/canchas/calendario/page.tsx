export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { getOrganizationReservationCalendar } from "@/lib/venues/reservation-calendar-queries";
import { shiftWeekStart } from "@/lib/venues/reservation-calendar-week";
import { ReservationCalendarGrid } from "@/components/venues/ReservationCalendarGrid";
import { ReservationCreateForm } from "@/components/venues/ReservationCreateForm";
import { PageHeader } from "@/components/ui/PageHeader";

type PageProps = {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ week?: string }>;
};

export default async function OrganizationReservationCalendarPage({
  params,
  searchParams,
}: PageProps) {
  const { organizationId } = await params;
  const { week } = await searchParams;
  const user = await requireUser();
  const membership = await requireOrganizationMembership(
    user.id,
    organizationId
  );
  const canManage =
    membership.role === "organization_owner" ||
    membership.role === "organization_admin";

  if (!canManage) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader
          title="Calendario de reservas"
          description="Solo administradores pueden consultar esta vista."
        />
      </div>
    );
  }

  const calendar = await getOrganizationReservationCalendar(
    organizationId,
    week
  );
  const prevWeek = shiftWeekStart(calendar.weekStart, -1);
  const nextWeek = shiftWeekStart(calendar.weekStart, 1);
  const baseHref = `/organizaciones/${organizationId}/canchas/calendario`;

  return (
    <div className="mx-auto max-w-[100rem] space-y-6">
      <PageHeader
        title="Calendario de reservas"
        description="Reservas confirmadas por fecha concreta. Partidos se ven aquí pero se gestionan desde su propia pantalla."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`${baseHref}?week=${prevWeek}`}
              className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
            >
              ← Semana anterior
            </Link>
            <Link
              href={`${baseHref}?week=${nextWeek}`}
              className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
            >
              Semana siguiente →
            </Link>
            <Link
              href={`/organizaciones/${organizationId}/canchas`}
              className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
            >
              Volver a canchas
            </Link>
          </div>
        }
      />

      <p className="text-sm text-text-secondary">
        Semana {calendar.weekStart} — {calendar.weekEnd}
      </p>

      {calendar.fields.length === 0 ? (
        <p className="text-sm text-muted">
          No hay canchas registradas. Crea canchas primero.
        </p>
      ) : (
        <>
          <ReservationCreateForm
            organizationId={organizationId}
            fields={calendar.fields}
            defaultDate={calendar.weekStart}
          />
          <ReservationCalendarGrid
            organizationId={organizationId}
            model={calendar.model}
          />
        </>
      )}
    </div>
  );
}
