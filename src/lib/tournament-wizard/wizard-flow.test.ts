import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  fixtureToJsonPayload,
  generateRoundRobinFixture,
} from "../fixtures/round-robin.ts";
import {
  bulkPlayerEntriesForRpc,
  parseBulkPlayerLines,
  parseBulkTeamNames,
} from "../teams/parse-bulk-players.ts";
import {
  buildWizardScheduleForFields,
  defaultWizardFieldCount,
} from "./schedule.ts";

describe("tournament wizard end-to-end flow (logic)", () => {
  it("walks through step inputs until a single-leg fixture is ready", () => {
    const step1 = {
      tournamentName: "Liga Express",
      approximateTeams: 4,
      fieldCount: 2,
    };

    assert.equal(step1.tournamentName.length >= 2, true);
    assert.equal(defaultWizardFieldCount(2, 0), 2);
    assert.equal(defaultWizardFieldCount(2, 1), 1);

    const step2Teams = parseBulkTeamNames(
      "Halcones FC\nLeones SC\nTigres United"
    );
    assert.equal(step2Teams.length, 3);
    assert.ok(step2Teams.length >= 2);

    const step3Players = parseBulkPlayerLines("Juan Pérez, 10\nMaría López");
    const rpcEntries = bulkPlayerEntriesForRpc("Juan Pérez, 10\nMaría López");
    assert.equal(step3Players[1]?.finalJersey, 1);
    assert.equal(step3Players[1]?.autoAssigned, true);
    assert.deepEqual(rpcEntries[1], {
      full_name: "María López",
      jersey_number: 1,
    });

    const fieldIds = ["field-1", "field-2"].slice(0, step1.fieldCount);
    const schedule = buildWizardScheduleForFields(
      fieldIds,
      6,
      "09:00",
      "14:00"
    );
    assert.equal(schedule.availabilityByField.length, 2);
    assert.equal(schedule.seasonBlocks.length, 2);
    assert.deepEqual(schedule.seasonBlocks[0], {
      field_id: "field-1",
      day_of_week: 6,
      starts_at: "09:00",
      ends_at: "14:00",
    });

    const fixtureTeams = step2Teams.map((name, index) => ({
      seasonTeamId: `st-${index + 1}`,
      name,
    }));
    const fixture = generateRoundRobinFixture(fixtureTeams, "single");
    const payload = fixtureToJsonPayload(fixture.matches);

    assert.equal(fixture.teamCount, 3);
    assert.equal(fixture.matches.length, 3);
    assert.equal(payload.length, 3);
  });
});
