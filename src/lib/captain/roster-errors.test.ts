import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { humanizeCaptainRosterAddError, humanizeCaptainJerseyUpdateError } from "@/lib/captain/roster-errors";

describe("humanizeCaptainRosterAddError", () => {
  it("maps max roster size", () => {
    const msg = humanizeCaptainRosterAddError(
      "Roster has reached the maximum size (15 players)"
    );
    assert.match(msg, /tope de 15 jugadores/);
  });

  it("maps roster locked", () => {
    const msg = humanizeCaptainRosterAddError(
      "Roster additions by the captain are locked for this team"
    );
    assert.match(msg, /bloqueó las altas/);
  });

  it("maps season seat conflict", () => {
    const msg = humanizeCaptainRosterAddError(
      "Player already occupies another active roster seat in this season"
    );
    assert.match(msg, /otro equipo en esta temporada/);
  });
});

describe("humanizeCaptainJerseyUpdateError", () => {
  it("maps roster lock for jersey edits", () => {
    const msg = humanizeCaptainJerseyUpdateError(
      "Roster jersey edits by the captain are locked for this team"
    );
    assert.match(msg, /plantel está bloqueado/);
  });
});
