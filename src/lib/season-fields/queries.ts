import { createClient } from "@/lib/supabase/server";
import {
  normalizeOrganizationSeasonFieldBlocks,
  type OrganizationSeasonFieldBlock,
} from "@/lib/season-fields/organization-blocks";
import { isFieldEffectivelyAvailable } from "@/lib/venues/types";
import type { ActiveFieldOption, SeasonFieldBlock } from "@/lib/season-fields/types";

function normalizeTime(value: string): string {
  return value.slice(0, 5);
}

export async function getActiveOrganizationFields(
  organizationId: string
): Promise<ActiveFieldOption[]> {
  const supabase = await createClient();

  const { data: fields } = await supabase
    .from("fields")
    .select("id, name, address, is_active")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("name");

  return (fields ?? [])
    .filter((field) => isFieldEffectivelyAvailable(field.is_active))
    .map((field) => ({
      id: field.id,
      name: field.name,
      address: field.address,
      fieldActive: field.is_active,
    }));
}

export async function getSeasonFieldBlocks(
  organizationId: string,
  seasonId: string
): Promise<SeasonFieldBlock[]> {
  const supabase = await createClient();

  const { data: blocks } = await supabase
    .from("season_field_blocks")
    .select("id, field_id, day_of_week, starts_at, ends_at, fields(name, address)")
    .eq("organization_id", organizationId)
    .eq("season_id", seasonId)
    .order("day_of_week")
    .order("starts_at");

  return (blocks ?? []).map((block) => {
    const field = block.fields as {
      name: string;
      address: string | null;
    } | null;

    return {
      id: block.id,
      field_id: block.field_id,
      field_name: field?.name ?? "Cancha",
      field_address: field?.address ?? null,
      day_of_week: block.day_of_week,
      starts_at: normalizeTime(block.starts_at),
      ends_at: normalizeTime(block.ends_at),
    };
  });
}

export async function getOrganizationSeasonFieldBlocks(
  organizationId: string
): Promise<OrganizationSeasonFieldBlock[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("season_field_blocks")
    .select(
      "id, field_id, season_id, day_of_week, starts_at, ends_at, fields(name), seasons(name, competition_id, competitions(name))"
    )
    .eq("organization_id", organizationId);

  return normalizeOrganizationSeasonFieldBlocks(data ?? []);
}
