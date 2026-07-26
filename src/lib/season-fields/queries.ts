import { createClient } from "@/lib/supabase/server";
import { isFieldEffectivelyAvailable } from "@/lib/venues/types";
import type { ActiveFieldOption, SeasonFieldBlock } from "@/lib/season-fields/types";

function normalizeTime(value: string): string {
  return value.slice(0, 5);
}

export async function getActiveOrganizationFields(
  organizationId: string
): Promise<ActiveFieldOption[]> {
  const supabase = await createClient();

  const { data: venues } = await supabase
    .from("venues")
    .select("id, name, is_active")
    .eq("organization_id", organizationId)
    .order("name");

  const { data: fields } = await supabase
    .from("fields")
    .select("id, name, venue_id, is_active")
    .eq("organization_id", organizationId)
    .order("name");

  const venueById = new Map(
    (venues ?? []).map((v) => [v.id, v] as const)
  );

  return (fields ?? [])
    .filter((field) => {
      const venue = venueById.get(field.venue_id);
      return (
        venue &&
        isFieldEffectivelyAvailable(field.is_active, venue.is_active)
      );
    })
    .map((field) => {
      const venue = venueById.get(field.venue_id)!;
      return {
        id: field.id,
        name: field.name,
        venueName: venue.name,
        venueActive: venue.is_active,
        fieldActive: field.is_active,
      };
    });
}

export async function getSeasonFieldBlocks(
  organizationId: string,
  seasonId: string
): Promise<SeasonFieldBlock[]> {
  const supabase = await createClient();

  const { data: blocks } = await supabase
    .from("season_field_blocks")
    .select(
      "id, field_id, day_of_week, starts_at, ends_at, fields(name, venues(name))"
    )
    .eq("organization_id", organizationId)
    .eq("season_id", seasonId)
    .order("day_of_week")
    .order("starts_at");

  return (blocks ?? []).map((block) => {
    const field = block.fields as {
      name: string;
      venues: { name: string } | null;
    } | null;

    return {
      id: block.id,
      field_id: block.field_id,
      field_name: field?.name ?? "Cancha",
      venue_name: field?.venues?.name ?? "",
      day_of_week: block.day_of_week,
      starts_at: normalizeTime(block.starts_at),
      ends_at: normalizeTime(block.ends_at),
    };
  });
}
