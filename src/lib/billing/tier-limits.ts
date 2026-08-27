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

export const SUBSCRIPTION_TIER_OPTIONS = [
  { value: "basico" as const, label: "Básico" },
  { value: "pro" as const, label: "Pro" },
  { value: "premium" as const, label: "Premium" },
];

export function subscriptionTierLabel(tier: SubscriptionTier): string {
  return SUBSCRIPTION_TIER_OPTIONS.find((option) => option.value === tier)?.label ?? tier;
}
