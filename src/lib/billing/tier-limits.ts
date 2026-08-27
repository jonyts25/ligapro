import { createClient } from "@/lib/supabase/server";
import { isSeasonArchived } from "@/lib/competitions/season-visibility";

/** v1 operational limits — adjust here when pricing changes. */
export const SUBSCRIPTION_TIER_LIMITS = {
  basico: {
    torneos_activos: 1,
    sedes: 1,
    canchas_total: 2,
    usuarios_staff: 2,
    cronicas_mes: 8,
  },
  pro: {
    torneos_activos: 4,
    sedes: 3,
    canchas_total: null,
    usuarios_staff: 6,
    cronicas_mes: 30,
  },
  premium: {
    torneos_activos: null,
    sedes: null,
    canchas_total: null,
    usuarios_staff: null,
    cronicas_mes: null,
  },
} as const;

export type SubscriptionTier = keyof typeof SUBSCRIPTION_TIER_LIMITS;

export type TierLimitKey = keyof (typeof SUBSCRIPTION_TIER_LIMITS)["basico"];

export type TierLimits = {
  [K in TierLimitKey]: number | null;
};

export type AddonOverrides = {
  torneos_extra?: number;
  sedes_extra?: number;
  canchas_extra?: number;
  usuarios_staff_extra?: number;
  cronicas_extra_mes?: number;
};

export type OrganizationSubscription = {
  subscriptionTier: SubscriptionTier;
  addonOverrides: AddonOverrides;
};

export type OrganizationUsage = {
  torneos_activos: number;
  sedes: number;
  canchas_total: number;
  usuarios_staff: number;
  cronicas_mes: number;
};

export type TierLimitResource = TierLimitKey;

const ADDON_KEY_BY_LIMIT: Record<TierLimitKey, keyof AddonOverrides> = {
  torneos_activos: "torneos_extra",
  sedes: "sedes_extra",
  canchas_total: "canchas_extra",
  usuarios_staff: "usuarios_staff_extra",
  cronicas_mes: "cronicas_extra_mes",
};

const LIMIT_LABELS: Record<TierLimitKey, string> = {
  torneos_activos: "torneos activos",
  sedes: "sedes activas",
  canchas_total: "canchas activas",
  usuarios_staff: "usuarios de staff",
  cronicas_mes: "crónicas este mes",
};

export function normalizeSubscriptionTier(value: string | null | undefined): SubscriptionTier {
  if (value === "pro" || value === "premium") return value;
  return "basico";
}

export function parseAddonOverrides(raw: unknown): AddonOverrides {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const source = raw as Record<string, unknown>;
  const readInt = (key: keyof AddonOverrides): number | undefined => {
    const value = source[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      return undefined;
    }
    return Math.floor(value);
  };
  return {
    torneos_extra: readInt("torneos_extra"),
    sedes_extra: readInt("sedes_extra"),
    canchas_extra: readInt("canchas_extra"),
    usuarios_staff_extra: readInt("usuarios_staff_extra"),
    cronicas_extra_mes: readInt("cronicas_extra_mes"),
  };
}

export function getEffectiveLimits(organization: OrganizationSubscription): TierLimits {
  const base = SUBSCRIPTION_TIER_LIMITS[organization.subscriptionTier];
  const overrides = organization.addonOverrides;

  return (Object.keys(base) as TierLimitKey[]).reduce((limits, key) => {
    const baseLimit = base[key];
    if (baseLimit === null) {
      limits[key] = null;
      return limits;
    }
    const addonKey = ADDON_KEY_BY_LIMIT[key];
    const extra = overrides[addonKey] ?? 0;
    limits[key] = baseLimit + extra;
    return limits;
  }, {} as TierLimits);
}

export function canCreateWithinLimit(
  currentCount: number,
  limit: number | null
): boolean {
  if (limit === null) return true;
  return currentCount < limit;
}

export function formatLimitReachedMessage(
  resource: TierLimitKey,
  limit: number | null
): string {
  const label = LIMIT_LABELS[resource];
  if (limit === null) {
    return `No puedes crear más ${label} con tu plan actual.`;
  }
  return `Tu plan actual permite ${limit} ${label}. Solicita un upgrade si necesitas más capacidad.`;
}

export function formatUsageLabel(current: number, limit: number | null): string {
  if (limit === null) return `${current} / ilimitado`;
  return `${current} / ${limit}`;
}

export function isResourceAtLimit(
  usage: OrganizationUsage,
  limits: TierLimits,
  resource: TierLimitKey
): boolean {
  return !canCreateWithinLimit(usage[resource], limits[resource]);
}

export type OrganizationTierLimitStatus = {
  subscription: OrganizationSubscription;
  limits: TierLimits;
  usage: OrganizationUsage;
  atLimit: Record<TierLimitKey, boolean>;
};

export function buildTierLimitStatus(
  subscription: OrganizationSubscription,
  usage: OrganizationUsage
): OrganizationTierLimitStatus {
  const limits = getEffectiveLimits(subscription);
  return {
    subscription,
    limits,
    usage,
    atLimit: {
      torneos_activos: isResourceAtLimit(usage, limits, "torneos_activos"),
      sedes: isResourceAtLimit(usage, limits, "sedes"),
      canchas_total: isResourceAtLimit(usage, limits, "canchas_total"),
      usuarios_staff: isResourceAtLimit(usage, limits, "usuarios_staff"),
      cronicas_mes: isResourceAtLimit(usage, limits, "cronicas_mes"),
    },
  };
}

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

export function evaluateTierLimit(
  status: OrganizationTierLimitStatus,
  resource: TierLimitKey
): { ok: true } | { ok: false; message: string } {
  if (!status.atLimit[resource]) {
    return { ok: true };
  }
  return {
    ok: false,
    message: formatLimitReachedMessage(resource, status.limits[resource]),
  };
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

export const SUBSCRIPTION_TIER_OPTIONS = [
  { value: "basico" as const, label: "Básico" },
  { value: "pro" as const, label: "Pro" },
  { value: "premium" as const, label: "Premium" },
];

export function subscriptionTierLabel(tier: SubscriptionTier): string {
  return SUBSCRIPTION_TIER_OPTIONS.find((option) => option.value === tier)?.label ?? tier;
}
