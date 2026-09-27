import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const ACTIONS_PATH = path.join(
  process.cwd(),
  "src/lib/venues/reservation-actions.ts"
);
const VALIDATION_PATH = path.join(
  process.cwd(),
  "src/lib/venues/reservation-validation.ts"
);

describe("reservation actions", () => {
  it("exports create and cancel server actions with admin gate", () => {
    const source = readFileSync(ACTIONS_PATH, "utf8");

    assert.match(source, /export async function createFieldReservationAction\(/);
    assert.match(source, /export async function cancelFieldReservationAction\(/);
    assert.match(source, /requireOrganizationAdmin/);
    assert.match(source, /validateCreateFieldReservationInput/);
    assert.match(source, /validateCancelFieldReservation/);
  });

  it("revalidates the calendar route after create/cancel", () => {
    const source = readFileSync(ACTIONS_PATH, "utf8");

    assert.match(
      source,
      /revalidatePath\(`\/organizaciones\/\$\{organizationId\}\/canchas\/calendario`\)/ 
    );
  });

  it("passes postgres errors through on insert failure", () => {
    const source = readFileSync(ACTIONS_PATH, "utf8");

    assert.match(source, /message: error\.message/);
  });
});

describe("createFieldReservationAction validation contract", () => {
  it("rejects match type before insert", () => {
    const source = readFileSync(VALIDATION_PATH, "utf8");

    assert.match(source, /reservationType === "match"/);
    assert.match(source, /Esta pantalla no crea reservas de partido/);
  });

  it("rejects invalid time ranges before insert", () => {
    const source = readFileSync(VALIDATION_PATH, "utf8");

    assert.match(source, /endsAt\) <= new Date\(startsAt\)/);
    assert.match(source, /posterior a la de inicio/);
  });
});

describe("cancelFieldReservationAction validation contract", () => {
  it("rejects match reservations before update", () => {
    const source = readFileSync(VALIDATION_PATH, "utf8");

    assert.match(source, /reservation_type === "match"/);
    assert.match(source, /desde su propia pantalla/);
  });
});
