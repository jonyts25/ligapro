import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeGuestOfficialInviteExpiry,
  getGuestMatchCapturePermissions,
  guestInviteHasName,
  guestInviteIsActive,
  validateGuestInviteForMatch,
  validateGuestUpdateResultAuthorization,
} from "@/lib/matches/guest-official";

const BASE_INVITE = {
  matchOfficialId: "mo-1",
  matchId: "match-1",
  organizationId: "org-1",
  seasonId: "season-1",
  competitionId: "comp-1",
  guestName: "Juan Pérez",
  role: "referee",
  status: "confirmed",
  inviteExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
};

describe("guest invite validation", () => {
  it("accepts a valid token for the matching match", () => {
    const result = validateGuestInviteForMatch(BASE_INVITE, "match-1");
    assert.equal(result.ok, true);
  });

  it("rejects a token for a different match", () => {
    const result = validateGuestInviteForMatch(BASE_INVITE, "match-2");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /no corresponde/i);
    }
  });

  it("rejects expired or inactive invites", () => {
    const expired = {
      ...BASE_INVITE,
      inviteExpiresAt: new Date(Date.now() - 60_000).toISOString(),
    };
    const result = validateGuestInviteForMatch(expired, "match-1");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /expiró/i);
    }
  });
});

describe("getGuestMatchCapturePermissions", () => {
  it("grants the same close-only referee permissions as authenticated flow", () => {
    const perms = getGuestMatchCapturePermissions(
      BASE_INVITE,
      { startsAt: null, calendarConfirmed: true },
      "in_progress"
    );
    assert.equal(perms.canCaptureEvents, true);
    assert.equal(perms.canUpdateResult, true);
    assert.equal(perms.closeOnlyResultUpdate, true);
    assert.equal(perms.canVoidEvents, false);
  });

  it("denies capture until the guest name is captured", () => {
    const perms = getGuestMatchCapturePermissions(
      { ...BASE_INVITE, guestName: null },
      { startsAt: null, calendarConfirmed: true },
      "in_progress"
    );
    assert.equal(perms.canCaptureEvents, false);
    assert.equal(perms.canUpdateResult, false);
  });

  it("denies updates once the match is closed", () => {
    const perms = getGuestMatchCapturePermissions(
      BASE_INVITE,
      { startsAt: null, calendarConfirmed: true },
      "finished"
    );
    assert.equal(perms.canUpdateResult, false);
  });
});

describe("validateGuestUpdateResultAuthorization", () => {
  it("allows finished and walkover but not cancelled", () => {
    for (const status of ["finished", "walkover"] as const) {
      const result = validateGuestUpdateResultAuthorization({
        statusRaw: status,
        currentStatus: "in_progress",
      });
      assert.equal(result.ok, true, status);
    }

    const cancel = validateGuestUpdateResultAuthorization({
      statusRaw: "cancelled",
      currentStatus: "in_progress",
    });
    assert.equal(cancel.ok, false);
  });
});

describe("computeGuestOfficialInviteExpiry", () => {
  it("uses the shorter of seven days or match date plus one day", () => {
    const now = new Date("2026-08-01T12:00:00.000Z");
    const soonMatch = computeGuestOfficialInviteExpiry(
      "2026-08-03T20:00:00.000Z",
      now
    );
    assert.equal(
      soonMatch.toISOString().slice(0, 10),
      "2026-08-04"
    );

    const farMatch = computeGuestOfficialInviteExpiry(
      "2026-09-15T20:00:00.000Z",
      now
    );
    assert.equal(
      farMatch.toISOString().slice(0, 10),
      "2026-08-08"
    );
  });
});

describe("guestInviteHasName", () => {
  it("treats blank names as missing", () => {
    assert.equal(guestInviteHasName({ ...BASE_INVITE, guestName: "  " }), false);
    assert.equal(guestInviteIsActive(BASE_INVITE), true);
  });
});
