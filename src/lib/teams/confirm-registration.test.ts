import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildConfirmTeamBlockedMessage,
  canConfirmTeamRegistration,
} from "@/lib/teams/confirm-registration";

describe("canConfirmTeamRegistration", () => {
  it("allows confirm when under max roster size", () => {
    const result = canConfirmTeamRegistration({
      registrationStatus: "registered",
      activePlayerCount: 10,
      maxRosterSize: 15,
    });
    assert.equal(result.ok, true);
  });

  it("allows confirm when max roster size is null", () => {
    const result = canConfirmTeamRegistration({
      registrationStatus: "registered",
      activePlayerCount: 50,
      maxRosterSize: null,
    });
    assert.equal(result.ok, true);
  });

  it("rejects when active players exceed max", () => {
    const result = canConfirmTeamRegistration({
      registrationStatus: "registered",
      activePlayerCount: 16,
      maxRosterSize: 15,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /16 jugadores activos/);
      assert.match(result.message, /máximo permitido es 15/);
    }
  });

  it("rejects non-registered teams", () => {
    const result = canConfirmTeamRegistration({
      registrationStatus: "confirmed",
      activePlayerCount: 0,
      maxRosterSize: null,
    });
    assert.equal(result.ok, false);
  });
});

describe("buildConfirmTeamBlockedMessage", () => {
  it("includes counts in Spanish message", () => {
    assert.equal(
      buildConfirmTeamBlockedMessage(18, 15),
      "Este equipo tiene 18 jugadores activos, el máximo permitido es 15 — marca a los jugadores excedentes como inactivos antes de confirmar."
    );
  });
});
