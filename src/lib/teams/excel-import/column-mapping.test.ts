import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeColumnMapping,
  proposeExcelColumnMapping,
  validateRequiredColumnMapping,
} from "@/lib/teams/excel-import/column-mapping";

describe("column mapping helpers", () => {
  it("normalizes unknown headers to null", () => {
    const mapping = normalizeColumnMapping(
      {
        equipo: "Equipo",
        jugador: "Missing",
        dorsal: null,
        telefono: null,
      },
      ["Equipo", "Jugador"]
    );

    assert.equal(mapping.jugador, null);
  });

  it("requires equipo and jugador", () => {
    assert.match(
      validateRequiredColumnMapping({
        equipo: null,
        jugador: "Jugador",
        dorsal: null,
        telefono: null,
      }) ?? "",
      /Equipo y Jugador/
    );
  });

  it("uses mocked AI response", async () => {
    const mapping = await proposeExcelColumnMapping(
      ["Team Name", "Player Name", "Number"],
      [["Halcones", "Juan", "10"]],
      async () => ({
        text: '{"equipo":"Team Name","jugador":"Player Name","dorsal":"Number","telefono":null}',
        error: null,
      })
    );

    assert.equal(mapping.equipo, "Team Name");
    assert.equal(mapping.jugador, "Player Name");
  });
});
