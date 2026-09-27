import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
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
  const { count, error } = await supabase
    .from("fields")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  if (error) throw new Error(error.message);
  return count ?? 0;
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

export async function assertCanGenerateChronicleWithClient(
  supabase: SupabaseClient<Database>,
  organizationId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("subscription_tier, addon_overrides")
    .eq("id", organizationId)
    .maybeSingle();

  if (orgError) throw new Error(orgError.message);
  if (!org) return { ok: false, message: "Organización no encontrada." };

  const monthStart = getMexicoCityMonthStartIso();
  const { count, error: countError } = await supabase
    .from("ai_jobs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("tipo", "cronica")
    .gte("created_at", monthStart);

  if (countError) throw new Error(countError.message);

  const status = buildTierLimitStatus(
    {
      subscriptionTier: normalizeSubscriptionTier(org.subscription_tier),
      addonOverrides: parseAddonOverrides(org.addon_overrides),
    },
    {
      torneos_activos: 0,
      sedes: 0,
      canchas_total: 0,
      usuarios_staff: 0,
      cronicas_mes: count ?? 0,
    }
  );

  return evaluateTierLimit(status, "cronicas_mes");
}
