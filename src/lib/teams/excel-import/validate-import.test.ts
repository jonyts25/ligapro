import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyColumnMapping } from "@/lib/teams/excel-import/apply-mapping";
import { validateMappedImportRows } from "@/lib/teams/excel-import/validate-import";

describe("excel import validation", () => {
  it("maps spreadsheet rows and skips invalid entries", () => {
    const mapped = applyColumnMapping(
      {
        headers: ["Equipo", "Jugador", "Dorsal"],
        rows: [
          ["Halcones", "Juan Pérez", "10"],
          ["", "Sin equipo", "1"],
          ["Halcones", "Juan Pérez", "11"],
        ],
      },
      {
        equipo: "Equipo",
        jugador: "Jugador",
        dorsal: "Dorsal",
        telefono: null,
      }
    );

    const validated = validateMappedImportRows(mapped);
    assert.equal(validated.rowsByTeam.get("Halcones")?.length, 1);
    assert.equal(validated.skippedRows.length, 2);
  });
});
