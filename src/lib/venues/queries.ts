import { createClient } from "@/lib/supabase/server";
import type { OrganizationFieldCard } from "@/lib/venues/field-cards";
import { mapOrganizationFieldDetail } from "@/lib/venues/field-model";
import {
  type AvailabilityInterval,
  type FieldDetail,
  type FieldRecord,
} from "@/lib/venues/types";

function normalizeTime(value: string): string {
  return value.slice(0, 5);
}

export async function getOrganizationFieldDetail(
  organizationId: string,
  fieldId: string
): Promise<FieldDetail | null> {
  const supabase = await createClient();

  const { data: field, error } = await supabase
    .from("fields")
    .select(
      "id, organization_id, venue_id, name, address, surface_type, is_active, modality, hourly_rate, parent_field_id"
    )
    .eq("id", fieldId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !field) return null;

  const intervals = await getFieldAvailability(organizationId, fieldId);

  let parentFieldName: string | null = null;
  if (field.parent_field_id) {
    const { data: parent } = await supabase
      .from("fields")
      .select("name")
      .eq("id", field.parent_field_id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    parentFieldName = parent?.name ?? null;
  }

  const { count: childCount } = await supabase
    .from("fields")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("parent_field_id", fieldId);

  return mapOrganizationFieldDetail(field as FieldRecord, intervals, {
    parentFieldName,
    childCount: childCount ?? 0,
  });
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

export async function getOrganizationFieldCards(
  organizationId: string
): Promise<OrganizationFieldCard[]> {
  const supabase = await createClient();

  const [{ data: fields }, { data: rules }, { data: blocks }] =
    await Promise.all([
      supabase
        .from("fields")
        .select(
          "id, name, address, surface_type, is_active, modality, hourly_rate, parent_field_id"
        )
        .eq("organization_id", organizationId)
        .order("name"),
      supabase
        .from("field_availability_rules")
        .select("field_id")
        .eq("organization_id", organizationId),
      supabase
        .from("season_field_blocks")
        .select("field_id, seasons!inner(visibility)")
        .eq("organization_id", organizationId)
        .neq("seasons.visibility", "archived"),
    ]);

  const rulesByField = new Map<string, number>();
  for (const rule of rules ?? []) {
    rulesByField.set(
      rule.field_id,
      (rulesByField.get(rule.field_id) ?? 0) + 1
    );
  }

  const blocksByField = new Map<string, number>();
  for (const block of blocks ?? []) {
    blocksByField.set(
      block.field_id,
      (blocksByField.get(block.field_id) ?? 0) + 1
    );
  }

  const parentNames = new Map(
    (fields ?? [])
      .filter((field) => field.parent_field_id)
      .map((field) => [field.parent_field_id as string, ""])
  );

  if (parentNames.size > 0) {
    const { data: parents } = await supabase
      .from("fields")
      .select("id, name")
      .eq("organization_id", organizationId)
      .in("id", [...parentNames.keys()]);

    for (const parent of parents ?? []) {
      parentNames.set(parent.id, parent.name);
    }
  }

  const childCountByParent = new Map<string, number>();
  for (const field of fields ?? []) {
    if (!field.parent_field_id) continue;
    childCountByParent.set(
      field.parent_field_id,
      (childCountByParent.get(field.parent_field_id) ?? 0) + 1
    );
  }

  return (fields ?? []).map((field) => ({
    fieldId: field.id,
    fieldName: field.name,
    address: field.address,
    surfaceType: field.surface_type,
    isActive: field.is_active,
    hasWeeklyAvailability: (rulesByField.get(field.id) ?? 0) > 0,
    activeBlockCount: blocksByField.get(field.id) ?? 0,
    parentFieldId: field.parent_field_id,
    parentFieldName: field.parent_field_id
      ? parentNames.get(field.parent_field_id) ?? null
      : null,
    childCount: childCountByParent.get(field.id) ?? 0,
    modality: field.modality,
    hourlyRate:
      field.hourly_rate === null || field.hourly_rate === undefined
        ? null
        : Number(field.hourly_rate),
  }));
}

/** @deprecated Use getOrganizationFieldStats — kept for dashboard/readiness compat */
export async function getOrganizationVenueStats(organizationId: string): Promise<{
  activeVenues: number;
  effectiveActiveFields: number;
  totalVenues: number;
  totalFields: number;
}> {
  const stats = await getOrganizationFieldStats(organizationId);
  return {
    activeVenues: stats.activeFields,
    effectiveActiveFields: stats.activeFields,
    totalVenues: stats.totalFields,
    totalFields: stats.totalFields,
  };
}

export async function getOrganizationFieldStats(organizationId: string): Promise<{
  activeFields: number;
  totalFields: number;
}> {
  const supabase = await createClient();

  const { data: fields } = await supabase
    .from("fields")
    .select("id, is_active")
    .eq("organization_id", organizationId);

  const activeFields = (fields ?? []).filter((field) => field.is_active).length;

  return {
    activeFields,
    totalFields: fields?.length ?? 0,
  };
}
