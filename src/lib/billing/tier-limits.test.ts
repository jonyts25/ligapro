import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildTierLimitStatus,
  canCreateWithinLimit,
  evaluateTierLimit,
  formatLimitReachedMessage,
  getEffectiveLimits,
  type OrganizationSubscription,
} from "@/lib/billing/tier-limits";

describe("getEffectiveLimits", () => {
  it("applies addon torneos_extra on top of basico base limit", () => {
    const organization: OrganizationSubscription = {
      subscriptionTier: "basico",
      addonOverrides: { torneos_extra: 1 },
    };

    const limits = getEffectiveLimits(organization);
    assert.equal(limits.torneos_activos, 2);
    assert.equal(limits.sedes, 1);
    assert.equal(limits.canchas_total, 2);
  });

  it("keeps premium resources unlimited regardless of addons", () => {
    const organization: OrganizationSubscription = {
      subscriptionTier: "premium",
      addonOverrides: { torneos_extra: 5, cronicas_extra_mes: 15 },
    };

    const limits = getEffectiveLimits(organization);
    assert.equal(limits.torneos_activos, null);
    assert.equal(limits.cronicas_mes, null);
  });
});

describe("canCreateWithinLimit", () => {
  it("never blocks when limit is null (premium tier)", () => {
    assert.equal(canCreateWithinLimit(999, null), true);
  });

  it("blocks when current usage reached the numeric limit", () => {
    assert.equal(canCreateWithinLimit(1, 1), false);
    assert.equal(canCreateWithinLimit(0, 1), true);
  });
});

describe("evaluateTierLimit", () => {
  const basicoAtTournamentLimit = buildTierLimitStatus(
    { subscriptionTier: "basico", addonOverrides: {} },
    {
      torneos_activos: 1,
      sedes: 0,
      canchas_total: 0,
      usuarios_staff: 1,
      cronicas_mes: 0,
    }
  );

  it("returns a clear plan message when basico is at tournament limit", () => {
    const result = evaluateTierLimit(basicoAtTournamentLimit, "torneos_activos");
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.message, /Tu plan actual permite 1 torneos activos/);
    assert.match(result.message, /upgrade/i);
  });

  it("allows creation below the effective limit after addon override", () => {
    const status = buildTierLimitStatus(
      { subscriptionTier: "basico", addonOverrides: { torneos_extra: 1 } },
      {
        torneos_activos: 1,
        sedes: 0,
        canchas_total: 0,
        usuarios_staff: 1,
        cronicas_mes: 0,
      }
    );

    const result = evaluateTierLimit(status, "torneos_activos");
    assert.equal(result.ok, true);
  });

  it("never blocks premium organizations at high usage", () => {
    const status = buildTierLimitStatus(
      { subscriptionTier: "premium", addonOverrides: {} },
      {
        torneos_activos: 50,
        sedes: 20,
        canchas_total: 100,
        usuarios_staff: 25,
        cronicas_mes: 200,
      }
    );

    assert.equal(evaluateTierLimit(status, "torneos_activos").ok, true);
    assert.equal(evaluateTierLimit(status, "cronicas_mes").ok, true);
  });

  it("blocks chronicle generation when monthly quota is exhausted", () => {
    const status = buildTierLimitStatus(
      { subscriptionTier: "basico", addonOverrides: {} },
      {
        torneos_activos: 0,
        sedes: 0,
        canchas_total: 0,
        usuarios_staff: 1,
        cronicas_mes: 8,
      }
    );

    const result = evaluateTierLimit(status, "cronicas_mes");
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(
      result.message,
      formatLimitReachedMessage("cronicas_mes", 8)
    );
  });
});

describe("formatLimitReachedMessage", () => {
  it("includes the numeric limit in user-facing copy", () => {
    const message = formatLimitReachedMessage("sedes", 3);
    assert.match(message, /Tu plan actual permite 3 sedes activas/);
  });
});
