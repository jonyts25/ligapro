import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  allowedStatusTransitionsForRole,
  resolveUpdateResultPermissions,
  validateUpdateResultAuthorization,
} from "@/lib/matches/update-result-permissions";
import { allowedStatusTransitions } from "@/lib/matches/types";

describe("resolveUpdateResultPermissions", () => {
  it("allows confirmed referee on an open match with close-only mode", () => {
    const perms = resolveUpdateResultPermissions({
      isOrgAdmin: false,
      isTournamentAdmin: false,
      isConfirmedReferee: true,
      currentMatchStatus: "in_progress",
    });
    assert.equal(perms.canUpdateResult, true);
    assert.equal(perms.closeOnlyResultUpdate, true);
  });

  it("denies confirmed referee on another match (not confirmed here)", () => {
    const perms = resolveUpdateResultPermissions({
      isOrgAdmin: false,
      isTournamentAdmin: false,
      isConfirmedReferee: false,
      currentMatchStatus: "in_progress",
    });
    assert.equal(perms.canUpdateResult, false);
  });

  it("denies assigned-but-not-confirmed referee via missing flag", () => {
    const perms = resolveUpdateResultPermissions({
      isOrgAdmin: false,
      isTournamentAdmin: false,
      isConfirmedReferee: false,
      currentMatchStatus: "scheduled",
    });
    assert.equal(perms.canUpdateResult, false);
  });

  it("denies confirmed referee once the match is already closed", () => {
    const perms = resolveUpdateResultPermissions({
      isOrgAdmin: false,
      isTournamentAdmin: false,
      isConfirmedReferee: true,
      currentMatchStatus: "finished",
    });
    assert.equal(perms.canUpdateResult, false);
  });

  it("keeps full admin permissions unchanged", () => {
    const orgAdmin = resolveUpdateResultPermissions({
      isOrgAdmin: true,
      isTournamentAdmin: false,
      isConfirmedReferee: false,
      currentMatchStatus: "finished",
    });
    assert.equal(orgAdmin.canUpdateResult, true);
    assert.equal(orgAdmin.closeOnlyResultUpdate, false);

    const tournAdmin = resolveUpdateResultPermissions({
      isOrgAdmin: false,
      isTournamentAdmin: true,
      isConfirmedReferee: false,
      currentMatchStatus: "finished",
    });
    assert.equal(tournAdmin.canUpdateResult, true);
    assert.equal(tournAdmin.closeOnlyResultUpdate, false);
  });
});

describe("validateUpdateResultAuthorization", () => {
  it("allows confirmed referee to close with finished or walkover", () => {
    for (const status of ["finished", "walkover"] as const) {
      const result = validateUpdateResultAuthorization({
        isOrgAdmin: false,
        isTournamentAdmin: false,
        isConfirmedReferee: true,
        statusRaw: status,
        currentStatus: "in_progress",
      });
      assert.equal(result.ok, true, status);
    }
  });

  it("rejects cancel or reopen attempts by confirmed referee", () => {
    const cancel = validateUpdateResultAuthorization({
      isOrgAdmin: false,
      isTournamentAdmin: false,
      isConfirmedReferee: true,
      statusRaw: "cancelled",
      currentStatus: "in_progress",
    });
    assert.equal(cancel.ok, false);
    if (!cancel.ok) {
      assert.match(cancel.message, /solo puedes cerrar/i);
    }

    const reopen = validateUpdateResultAuthorization({
      isOrgAdmin: false,
      isTournamentAdmin: false,
      isConfirmedReferee: true,
      statusRaw: "in_progress",
      currentStatus: "finished",
    });
    assert.equal(reopen.ok, false);
    if (!reopen.ok) {
      assert.match(reopen.message, /ya cerrado/i);
    }
  });

  it("still allows tournament_admin to cancel", () => {
    const result = validateUpdateResultAuthorization({
      isOrgAdmin: false,
      isTournamentAdmin: true,
      isConfirmedReferee: false,
      statusRaw: "cancelled",
      currentStatus: "in_progress",
    });
    assert.equal(result.ok, true);
  });
});

describe("allowedStatusTransitionsForRole", () => {
  it("hides reopen and cancel options for close-only referees", () => {
    const closeOnly = allowedStatusTransitionsForRole("finished", true);
    assert.deepEqual(closeOnly, ["finished"]);
    assert.doesNotMatch(closeOnly.join(","), /in_progress/);
    assert.doesNotMatch(closeOnly.join(","), /cancelled/);

    const inProgress = allowedStatusTransitionsForRole("in_progress", true);
    assert.deepEqual(inProgress, ["in_progress", "finished", "walkover"]);
    assert.doesNotMatch(inProgress.join(","), /cancelled/);
  });

  it("matches default admin transitions when not close-only", () => {
    assert.deepEqual(
      allowedStatusTransitionsForRole("finished", false),
      allowedStatusTransitions("finished")
    );
  });
});
