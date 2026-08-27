import { createClient } from "@/lib/supabase/server";
import { isSeasonArchived } from "@/lib/competitions/season-visibility";
import {
  buildTierLimitStatus,
  evaluateTierLimit,
  normalizeSubscriptionTier,
  parseAddonOverrides,
  type OrganizationSubscription,
  type OrganizationTierLimitStatus,
  type OrganizationUsage,
} from "@/lib/billing/tier-limits";

function getMexicoCityMonthStartIso(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${year}-${month}-01T00:00:00-06:00`;
}

export async function getOrganizationSubscription(
  organizationId: string
): Promise<OrganizationSubscription | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("subscription_tier, addon_overrides")
    .eq("id", organizationId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    subscriptionTier: normalizeSubscriptionTier(data.subscription_tier),
    addonOverrides: parseAddonOverrides(data.addon_overrides),
  };
}

export async function countActiveCompetitions(
  organizationId: string
): Promise<number> {
  const supabase = await createClient();
  const { data: competitions, error } = await supabase
    .from("competitions")
    .select("id, seasons ( visibility )")
    .eq("organization_id", organizationId);

  if (error) throw new Error(error.message);

  return (competitions ?? []).filter((competition) =>
    (competition.seasons ?? []).some(
      (season) => !isSeasonArchived(String(season.visibility))
    )
  ).length;
}

export async function countActiveVenues(organizationId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("venues")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function countActiveFields(organizationId: string): Promise<number> {
  const supabase = await createClient();
  const { data: fields, error: fieldsError } = await supabase
    .from("fields")
    .select("id, venue_id, is_active")
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  if (fieldsError) throw new Error(fieldsError.message);
  if (!fields?.length) return 0;

  const venueIds = [...new Set(fields.map((field) => field.venue_id))];
  const { data: venues, error: venuesError } = await supabase
    .from("venues")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .in("id", venueIds);

  if (venuesError) throw new Error(venuesError.message);
  const activeVenueIds = new Set((venues ?? []).map((venue) => venue.id));
  return fields.filter((field) => activeVenueIds.has(field.venue_id)).length;
}

export async function countStaffUsers(organizationId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .in("role", ["organization_owner", "organization_admin"]);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function countChroniclesThisMonth(
  organizationId: string
): Promise<number> {
  const supabase = await createClient();
  const monthStart = getMexicoCityMonthStartIso();
  const { count, error } = await supabase
    .from("ai_jobs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("tipo", "cronica")
    .gte("created_at", monthStart);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getOrganizationUsage(
  organizationId: string
): Promise<OrganizationUsage> {
  const [
    torneos_activos,
    sedes,
    canchas_total,
    usuarios_staff,
    cronicas_mes,
  ] = await Promise.all([
    countActiveCompetitions(organizationId),
    countActiveVenues(organizationId),
    countActiveFields(organizationId),
    countStaffUsers(organizationId),
    countChroniclesThisMonth(organizationId),
  ]);

  return {
    torneos_activos,
    sedes,
    canchas_total,
    usuarios_staff,
    cronicas_mes,
  };
}

export async function getOrganizationTierLimitStatus(
  organizationId: string
): Promise<OrganizationTierLimitStatus | null> {
  const subscription = await getOrganizationSubscription(organizationId);
  if (!subscription) return null;
  const usage = await getOrganizationUsage(organizationId);
  return buildTierLimitStatus(subscription, usage);
}

export async function assertCanCreateCompetition(
  organizationId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const status = await getOrganizationTierLimitStatus(organizationId);
  if (!status) return { ok: false, message: "Organización no encontrada." };
  return evaluateTierLimit(status, "torneos_activos");
}

export async function assertCanCreateVenue(
  organizationId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const status = await getOrganizationTierLimitStatus(organizationId);
  if (!status) return { ok: false, message: "Organización no encontrada." };
  return evaluateTierLimit(status, "sedes");
}

export async function assertCanCreateField(
  organizationId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const status = await getOrganizationTierLimitStatus(organizationId);
  if (!status) return { ok: false, message: "Organización no encontrada." };
  return evaluateTierLimit(status, "canchas_total");
}

export async function assertCanInviteStaffMember(
  organizationId: string,
  role: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (role !== "organization_admin") {
    return { ok: true };
  }
  const status = await getOrganizationTierLimitStatus(organizationId);
  if (!status) return { ok: false, message: "Organización no encontrada." };
  return evaluateTierLimit(status, "usuarios_staff");
}

export async function assertCanGenerateChronicle(
  organizationId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const status = await getOrganizationTierLimitStatus(organizationId);
  if (!status) return { ok: false, message: "Organización no encontrada." };
  return evaluateTierLimit(status, "cronicas_mes");
}
