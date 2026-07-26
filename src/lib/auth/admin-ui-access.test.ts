import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canShowAdminUiSurface,
  isOrganizationAdminRole,
  type AdminUiSurface,
} from "@/lib/auth/is-organization-admin";

const ADMIN_SURFACES: AdminUiSurface[] = [
  "finanzas_page",
  "finanzas_nav_link",
  "discipline_admin_panel",
  "match_reschedule_admin_panel",
  "match_programar_link",
  "match_officials_manage",
];

describe("isOrganizationAdminRole", () => {
  it("returns true for owner and admin", () => {
    assert.equal(isOrganizationAdminRole("organization_owner"), true);
    assert.equal(isOrganizationAdminRole("organization_admin"), true);
  });

  it("returns false for member and non-org roles", () => {
    assert.equal(isOrganizationAdminRole("organization_member"), false);
    assert.equal(isOrganizationAdminRole(null), false);
    assert.equal(isOrganizationAdminRole(undefined), false);
    assert.equal(isOrganizationAdminRole("tournament_admin"), false);
  });
});

describe("canShowAdminUiSurface — admin panels must not render for member/captain", () => {
  for (const surface of ADMIN_SURFACES) {
    it(`denies ${surface} for organization_member`, () => {
      assert.equal(canShowAdminUiSurface(surface, "organization_member"), false);
    });

    it(`denies ${surface} when there is no org membership (captain/vice)`, () => {
      assert.equal(canShowAdminUiSurface(surface, null), false);
    });
  }

  for (const surface of ADMIN_SURFACES) {
    it(`allows ${surface} for organization_admin`, () => {
      assert.equal(canShowAdminUiSurface(surface, "organization_admin"), true);
    });
  }
});

/**
 * Mirrors server/page gating (see audit 2026-07-26):
 * - finanzas/page.tsx → requireOrganizationAdmin (404 member/captain)
 * - disciplina/page.tsx → DisciplineAdminPanel only if isOrganizationAdminRole
 * - partidos/[matchId]/page.tsx → MatchRescheduleAdminPanel + programar link only if admin
 * - SeasonStandingsNav → Finanzas link only if canManage (admin)
 * Captains cannot reach org layout today (requireOrganizationMembership in layout).
 */
describe("documented page gating contract", () => {
  it("member sees disciplina table but not admin panel flag", () => {
    assert.equal(
      canShowAdminUiSurface("discipline_admin_panel", "organization_member"),
      false
    );
  });

  it("captain on shared match route would not see reschedule admin panel", () => {
    assert.equal(
      canShowAdminUiSurface("match_reschedule_admin_panel", null),
      false
    );
  });

  it("finanzas route is admin-only at page guard level", () => {
    assert.equal(
      canShowAdminUiSurface("finanzas_page", "organization_member"),
      false
    );
    assert.equal(canShowAdminUiSurface("finanzas_page", null), false);
  });
});
