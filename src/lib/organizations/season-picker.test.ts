import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildOrganizationScopedHref,
  parseSeasonContextFromPathname,
  resolveOrganizationSeasonSelection,
  shouldCanonicalizeOrganizationSeasonQuery,
} from "@/lib/organizations/season-picker";

const seasons = [
  {
    seasonId: "season-old",
    competitionId: "comp-a",
    label: "Torneo A",
    competitionName: "Liga A",
    createdAt: "2026-01-01T00:00:00Z",
    startsOn: "2026-01-01",
  },
  {
    seasonId: "season-new",
    competitionId: "comp-b",
    label: "Torneo B",
    competitionName: "Liga B",
    createdAt: "2026-06-01T00:00:00Z",
    startsOn: "2026-06-01",
  },
];

describe("parseSeasonContextFromPathname", () => {
  it("parses standard torneo routes", () => {
    const ctx = parseSeasonContextFromPathname(
      "/organizaciones/org-1/torneos/comp-1/temporadas/season-1/calendario"
    );
    assert.deepEqual(ctx, {
      organizationId: "org-1",
      competitionId: "comp-1",
      seasonId: "season-1",
    });
  });

  it("parses wizard routes without temporadas segment", () => {
    const ctx = parseSeasonContextFromPathname(
      "/organizaciones/org-1/torneos/asistente/comp-1/season-1/equipos"
    );
    assert.deepEqual(ctx, {
      organizationId: "org-1",
      competitionId: "comp-1",
      seasonId: "season-1",
    });
  });
});

describe("resolveOrganizationSeasonSelection", () => {
  it("resolves by seasonId alone when competitionId is missing", () => {
    const selected = resolveOrganizationSeasonSelection(seasons, "season-old");
    assert.equal(selected?.seasonId, "season-old");
    assert.equal(selected?.competitionId, "comp-a");
  });

  it("resolves by competitionId alone to the latest season in that competition", () => {
    const selected = resolveOrganizationSeasonSelection(
      seasons,
      undefined,
      "comp-b"
    );
    assert.equal(selected?.seasonId, "season-new");
  });
});

describe("shouldCanonicalizeOrganizationSeasonQuery", () => {
  it("returns a season when only seasonId is present in the URL", () => {
    const canonical = shouldCanonicalizeOrganizationSeasonQuery(
      seasons,
      "season-old"
    );
    assert.equal(canonical?.competitionId, "comp-a");
  });
});

describe("buildOrganizationScopedHref", () => {
  it("links partidos hub to the season calendar", () => {
    const href = buildOrganizationScopedHref("org-1", "partidos", {
      seasonId: "season-1",
      competitionId: "comp-1",
    });
    assert.equal(
      href,
      "/organizaciones/org-1/torneos/comp-1/temporadas/season-1/calendario"
    );
  });
});
