import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCsv, slugifyFilename } from "@/lib/export/csv";

describe("buildCsv", () => {
  it("adds UTF-8 BOM and escapes quoted values", () => {
    const csv = buildCsv(["Nombre", "Notas"], [
      ["Equipo A", 'Dice "hola"'],
      ["Equipo B", null],
    ]);

    assert.ok(csv.startsWith("\uFEFF"));
    assert.match(csv, /Nombre,Notas/);
    assert.match(csv, /"Dice ""hola"""/);
    assert.match(csv, /Equipo B,/);
  });
});

describe("slugifyFilename", () => {
  it("normalizes accents and unsafe characters", () => {
    assert.equal(slugifyFilename("Temporada Apertura 2026"), "temporada-apertura-2026");
    assert.equal(slugifyFilename("José María"), "jose-maria");
  });
});
