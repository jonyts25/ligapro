import { createClient } from "@/lib/supabase/server";
import {
  isFieldEffectivelyAvailable,
  type AvailabilityInterval,
  type FieldWithAvailability,
  type VenueDetail,
  type VenueListItem,
  type VenueRecord,
} from "@/lib/venues/types";

function normalizeTime(value: string): string {
  // Postgres time may arrive as HH:MM:SS — normalize to HH:MM for UI/RPC.
  return value.slice(0, 5);
}

export async function getOrganizationVenues(
  organizationId: string
): Promise<{ venues: VenueListItem[]; totalFields: number }> {
  const supabase = await createClient();

  const { data: venues, error } = await supabase
    .from("venues")
    .select("id, organization_id, name, address, is_active")
    .eq("organization_id", organizationId)
    .order("name");

  if (error || !venues) {
    return { venues: [], totalFields: 0 };
  }

  const { data: fields } = await supabase
    .from("fields")
    .select("id, venue_id")
    .eq("organization_id", organizationId);

  const counts = new Map<string, number>();
  for (const field of fields ?? []) {
    counts.set(field.venue_id, (counts.get(field.venue_id) ?? 0) + 1);
  }

  const list: VenueListItem[] = venues.map((venue) => ({
    ...(venue as VenueRecord),
    fieldCount: counts.get(venue.id) ?? 0,
  }));

  return {
    venues: list,
    totalFields: fields?.length ?? 0,
  };
}

export async function getVenueWithFields(
  organizationId: string,
  venueId: string
): Promise<VenueDetail | null> {
  const supabase = await createClient();

  const { data: venue, error } = await supabase
    .from("venues")
    .select("id, organization_id, name, address, is_active")
    .eq("id", venueId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !venue) return null;

  const { data: fields } = await supabase
    .from("fields")
    .select("id, venue_id, organization_id, name, surface_type, is_active")
    .eq("venue_id", venueId)
    .eq("organization_id", organizationId)
    .order("name");

  const fieldIds = (fields ?? []).map((f) => f.id);
  const intervalsByField = new Map<string, AvailabilityInterval[]>();

  if (fieldIds.length > 0) {
    const { data: rules } = await supabase
      .from("field_availability_rules")
      .select("id, field_id, day_of_week, starts_at, ends_at")
      .in("field_id", fieldIds)
      .eq("organization_id", organizationId)
      .order("day_of_week")
      .order("starts_at");

    for (const rule of rules ?? []) {
      const list = intervalsByField.get(rule.field_id) ?? [];
      list.push({
        id: rule.id,
        day_of_week: rule.day_of_week,
        starts_at: normalizeTime(rule.starts_at),
        ends_at: normalizeTime(rule.ends_at),
      });
      intervalsByField.set(rule.field_id, list);
    }
  }

  const enriched: FieldWithAvailability[] = (fields ?? []).map((field) => ({
    ...field,
    intervals: intervalsByField.get(field.id) ?? [],
    effectivelyAvailable: isFieldEffectivelyAvailable(
      field.is_active,
      venue.is_active
    ),
  }));

  return {
    ...(venue as VenueRecord),
    fields: enriched,
  };
}

export async function getFieldAvailability(
  organizationId: string,
  fieldId: string
): Promise<AvailabilityInterval[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("field_availability_rules")
    .select("id, day_of_week, starts_at, ends_at")
    .eq("field_id", fieldId)
    .eq("organization_id", organizationId)
    .order("day_of_week")
    .order("starts_at");

  return (data ?? []).map((rule) => ({
    id: rule.id,
    day_of_week: rule.day_of_week,
    starts_at: normalizeTime(rule.starts_at),
    ends_at: normalizeTime(rule.ends_at),
  }));
}

export async function getOrganizationVenueStats(organizationId: string): Promise<{
  activeVenues: number;
  effectiveActiveFields: number;
  totalVenues: number;
  totalFields: number;
}> {
  const supabase = await createClient();

  const { data: venues } = await supabase
    .from("venues")
    .select("id, is_active")
    .eq("organization_id", organizationId);

  const { data: fields } = await supabase
    .from("fields")
    .select("id, venue_id, is_active")
    .eq("organization_id", organizationId);

  const venueActive = new Map(
    (venues ?? []).map((v) => [v.id, v.is_active] as const)
  );

  const activeVenues = (venues ?? []).filter((v) => v.is_active).length;
  const effectiveActiveFields = (fields ?? []).filter(
    (f) => f.is_active && venueActive.get(f.venue_id) === true
  ).length;

  return {
    activeVenues,
    effectiveActiveFields,
    totalVenues: venues?.length ?? 0,
    totalFields: fields?.length ?? 0,
  };
}
