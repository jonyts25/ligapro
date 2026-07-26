import { createClient } from "@/lib/supabase/server";
import { DAY_LABELS_ES } from "@/lib/venues/types";

export type AvailabilityOverviewSlot = {
  kind: "availability" | "reservation" | "season_block";
  dayOfWeek: number;
  dayLabel: string;
  startsAt: string;
  endsAt: string;
  label: string;
  detail?: string | null;
};

export type FieldAvailabilityOverview = {
  fieldId: string;
  fieldName: string;
  venueName: string;
  weekStart: string;
  weekEnd: string;
  slots: AvailabilityOverviewSlot[];
};

function normalizeTime(value: string): string {
  return value.slice(0, 5);
}

function formatDateLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function dayOfWeekFromIso(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

/**
 * Read-only cross-source availability for one field and week.
 * Implemented with 3 client-side queries (no RPC) — see FRONTEND_CANCHA_PORTAL_COMPLETO_REPORT.md.
 */
export async function getFieldAvailabilityOverview(
  organizationId: string,
  fieldId: string,
  weekStart: string
): Promise<FieldAvailabilityOverview | null> {
  const supabase = await createClient();
  const weekEnd = addDays(weekStart, 6);

  const { data: field } = await supabase
    .from("fields")
    .select("id, name, venues(name)")
    .eq("id", fieldId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!field) return null;

  const venue = field.venues as { name: string } | null;

  const [{ data: rules }, { data: reservations }, { data: blocks }] =
    await Promise.all([
      supabase
        .from("field_availability_rules")
        .select("day_of_week, starts_at, ends_at")
        .eq("field_id", fieldId)
        .eq("organization_id", organizationId)
        .order("day_of_week")
        .order("starts_at"),
      supabase
        .from("field_reservations")
        .select(
          "starts_at, ends_at, status, matches(seasons(name))"
        )
        .eq("field_id", fieldId)
        .eq("organization_id", organizationId)
        .eq("status", "confirmed")
        .gte("starts_at", `${weekStart}T00:00:00`)
        .lte("starts_at", `${weekEnd}T23:59:59`)
        .order("starts_at"),
      supabase
        .from("season_field_blocks")
        .select("day_of_week, starts_at, ends_at, seasons(name)")
        .eq("field_id", fieldId)
        .eq("organization_id", organizationId)
        .order("day_of_week")
        .order("starts_at"),
    ]);

  const slots: AvailabilityOverviewSlot[] = [];

  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDays(weekStart, offset);
    const dow = dayOfWeekFromIso(date);
    const dayLabel = `${formatDateLabel(date)} (${DAY_LABELS_ES[dow]})`;

    for (const rule of rules ?? []) {
      if (rule.day_of_week !== dow) continue;
      slots.push({
        kind: "availability",
        dayOfWeek: dow,
        dayLabel,
        startsAt: normalizeTime(rule.starts_at),
        endsAt: normalizeTime(rule.ends_at),
        label: "Disponible (horario habitual)",
      });
    }

    for (const block of blocks ?? []) {
      if (block.day_of_week !== dow) continue;
      const season = block.seasons as { name: string } | null;
      slots.push({
        kind: "season_block",
        dayOfWeek: dow,
        dayLabel,
        startsAt: normalizeTime(block.starts_at),
        endsAt: normalizeTime(block.ends_at),
        label: "Reservado por torneo",
        detail: season?.name ?? null,
      });
    }
  }

  for (const reservation of reservations ?? []) {
    const starts = new Date(reservation.starts_at);
    const ends = new Date(reservation.ends_at);
    const date = reservation.starts_at.slice(0, 10);
    const dow = dayOfWeekFromIso(date);
    const match = reservation.matches as {
      seasons: { name: string } | null;
    } | null;
    const seasonName = match?.seasons?.name ?? "Partido";

    slots.push({
      kind: "reservation",
      dayOfWeek: dow,
      dayLabel: `${formatDateLabel(date)} (${DAY_LABELS_ES[dow]})`,
      startsAt: starts.toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      endsAt: ends.toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      label: "Ocupado (partido/reserva)",
      detail: seasonName,
    });
  }

  slots.sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
    return a.startsAt.localeCompare(b.startsAt);
  });

  return {
    fieldId: field.id,
    fieldName: field.name,
    venueName: venue?.name ?? "",
    weekStart,
    weekEnd,
    slots,
  };
}

export async function getOrganizationFieldsForOverview(
  organizationId: string
): Promise<Array<{ id: string; label: string }>> {
  const supabase = await createClient();
  const { data: fields } = await supabase
    .from("fields")
    .select("id, name, venues(name)")
    .eq("organization_id", organizationId)
    .order("name");

  return (fields ?? []).map((field) => {
    const venue = field.venues as { name: string } | null;
    return {
      id: field.id,
      label: venue ? `${venue.name} · ${field.name}` : field.name,
    };
  });
}

export function getWeekStartFromDate(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
