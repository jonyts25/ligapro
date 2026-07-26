import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AUTH_CALLBACK_ALLOWED_NEXT,
  AUTH_CALLBACK_ALLOWED_PREFIXES,
  getSafeInternalPath,
} from "@/lib/auth/validation";

describe("getSafeInternalPath — captain portal routes", () => {
  it("allows /mi-equipo exact path", () => {
    assert.equal(
      getSafeInternalPath("/mi-equipo", AUTH_CALLBACK_ALLOWED_NEXT),
      "/mi-equipo"
    );
  });

  it("allows /mi-equipo/[id] via prefix", () => {
    assert.equal(
      getSafeInternalPath(
        "/mi-equipo/abc-123",
        AUTH_CALLBACK_ALLOWED_NEXT,
        AUTH_CALLBACK_ALLOWED_PREFIXES
      ),
      "/mi-equipo/abc-123"
    );
  });

  it("allows /invitacion/[token] via prefix", () => {
    assert.equal(
      getSafeInternalPath(
        "/invitacion/dead-beef",
        AUTH_CALLBACK_ALLOWED_NEXT,
        AUTH_CALLBACK_ALLOWED_PREFIXES
      ),
      "/invitacion/dead-beef"
    );
  });

  it("rejects external redirects", () => {
    assert.equal(
      getSafeInternalPath("//evil.test", AUTH_CALLBACK_ALLOWED_NEXT),
      null
    );
    assert.equal(
      getSafeInternalPath("https://evil.test", AUTH_CALLBACK_ALLOWED_NEXT),
      null
    );
  });
});

describe("resolveAuthDestination routing policy", () => {
  function resolveFromCounts(
    membershipCount: number,
    captainTeamCount: number,
    firstOrgId = "org-1",
    firstCaptainTeamId = "st-1"
  ): string {
    if (membershipCount > 0) {
      if (membershipCount === 1) {
        return `/organizaciones/${firstOrgId}/inicio`;
      }
      return "/seleccionar-organizacion";
    }
    if (captainTeamCount === 1) {
      return `/mi-equipo/${firstCaptainTeamId}`;
    }
    if (captainTeamCount > 1) {
      return "/mi-equipo";
    }
    return "/onboarding";
  }

  it("captain-only user goes to portal, not onboarding", () => {
    assert.equal(resolveFromCounts(0, 1), "/mi-equipo/st-1");
    assert.equal(resolveFromCounts(0, 2), "/mi-equipo");
  });

  it("org membership takes priority over captain teams", () => {
    assert.equal(
      resolveFromCounts(1, 3, "org-abc", "st-9"),
      "/organizaciones/org-abc/inicio"
    );
    assert.equal(resolveFromCounts(2, 1), "/seleccionar-organizacion");
  });

  it("zero memberships and zero captain teams goes to onboarding", () => {
    assert.equal(resolveFromCounts(0, 0), "/onboarding");
  });
});
