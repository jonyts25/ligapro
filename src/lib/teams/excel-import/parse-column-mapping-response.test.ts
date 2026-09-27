import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseColumnMappingResponse } from "@/lib/teams/excel-import/parse-column-mapping-response";

describe("parseColumnMappingResponse", () => {
  it("parses bare JSON mapping", () => {
    assert.deepEqual(
      parseColumnMappingResponse(
        '{"equipo":"Team","jugador":"Player","dorsal":"Num","telefono":null}'
      ),
      {
        equipo: "Team",
        jugador: "Player",
        dorsal: "Num",
        telefono: null,
      }
    );
  });

  it("extracts JSON surrounded by extra text", () => {
    assert.deepEqual(
      parseColumnMappingResponse(
        'Propuesta:\n{"equipo":"Equipo","jugador":"Nombre","dorsal":null,"telefono":"Tel"}\nFin'
      ).equipo,
      "Equipo"
    );
  });
});
