import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAdminRosterContactMessage,
  buildCaptainWhatsAppLink,
  buildRescheduleWhatsAppMessage,
} from "@/lib/captain/whatsapp";

describe("buildCaptainWhatsAppLink", () => {
  it("strips non-digits from phone", () => {
    const url = buildCaptainWhatsAppLink("+52 55 1234 5678", "Hola");
    assert.match(url, /^https:\/\/wa\.me\/525512345678\?text=/);
  });
});

describe("buildAdminRosterContactMessage", () => {
  it("includes competition name", () => {
    const msg = buildAdminRosterContactMessage("Liga Premier");
    assert.match(msg, /administrador de Liga Premier/);
  });
});

describe("buildRescheduleWhatsAppMessage", () => {
  it("includes team, rival and proposed time", () => {
    const msg = buildRescheduleWhatsAppMessage({
      teamName: "Halcones",
      opponentName: "Titanes",
      proposedDateTimeLabel: "10 ago 2026, 6:00 p.m.",
      venueLabel: "Cancha 1",
    });
    assert.match(msg, /Halcones/);
    assert.match(msg, /Titanes/);
    assert.match(msg, /10 ago 2026/);
    assert.match(msg, /Cancha 1/);
  });
});
