import { createClient } from "@/lib/supabase/server";
import { getOrganizationSeasonFieldBlocks } from "@/lib/season-fields/queries";
import {
  buildOrganizationAvailabilityGridModel,
  type AvailabilityRuleInterval,
  type AvailabilityGridFieldRow,
  type OrganizationAvailabilityGridModel,
} from "@/lib/venues/organization-availability-grid";

function normalizeTime(value: string): string {
  return value.slice(0, 5);
}

export async function getOrganizationAvailabilityGridData(
  organizationId: string
): Promise<OrganizationAvailabilityGridModel> {
  const supabase = await createClient();

  const [{ data: fields }, { data: rules }, blocks] = await Promise.all([
    supabase
      .from("fields")
      .select("id, name, venues(name)")
      .eq("organization_id", organizationId)
      .order("name"),
    supabase
      .from("field_availability_rules")
      .select("field_id, day_of_week, starts_at, ends_at")
      .eq("organization_id", organizationId),
    getOrganizationSeasonFieldBlocks(organizationId),
  ]);

  const rulesByField = new Map<string, number>();
  const availabilityRules: AvailabilityRuleInterval[] = (rules ?? []).map(
    (rule) => {
      rulesByField.set(
        rule.field_id,
        (rulesByField.get(rule.field_id) ?? 0) + 1
      );
      return {
        fieldId: rule.field_id,
        dayOfWeek: rule.day_of_week,
        startsAt: normalizeTime(rule.starts_at),
        endsAt: normalizeTime(rule.ends_at),
      };
    }
  );

  const fieldRows: AvailabilityGridFieldRow[] = (fields ?? []).map((field) => {
    const venue = field.venues as { name: string } | null;
    const venueName = venue?.name ?? "";
    return {
      fieldId: field.id,
      fieldName: field.name,
      fieldLabel: venueName ? `${venueName} · ${field.name}` : field.name,
      hasWeeklyAvailability: (rulesByField.get(field.id) ?? 0) > 0,
    };
  });

  return buildOrganizationAvailabilityGridModel({
    fields: fieldRows,
    availabilityRules,
    blocks,
  });
}
