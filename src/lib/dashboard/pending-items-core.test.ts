import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildMatchesWithoutRefereeCategory,
  buildOpenDisputesCategory,
  buildOrganizationPendingItems,
  buildPendingTeamRegistrationRequestsCategory,
  buildResultsNotCapturedCategory,
  buildResultsPendingApprovalCategory,
  buildTeamsWithBalanceDueCategory,
  type PendingTeamRegistrationRequestSource,
  type PendingDisputeSource,
  type PendingFinanceSource,
  type PendingMatchSource,
} from "@/lib/dashboard/pending-items-core";

const ORG = "org-1";
const NOW = new Date("2026-09-27T20:00:00.000Z").getTime();
const WINDOW_END = NOW + 7 * 24 * 60 * 60 * 1000;

const baseMatch: PendingMatchSource = {
  matchId: "match-1",
  seasonId: "season-1",
  competitionId: "comp-1",
  seasonName: "Apertura 2026",
  homeTeamName: "Halcones",
  awayTeamName: "Leones",
  startsAt: "2026-09-28T18:00:00.000Z",
  status: "scheduled",
  hasConfirmedReferee: false,
  hasOpenDispute: false,
  isResultOfficial: false,
  matchDurationMinutes: 90,
};

describe("buildMatchesWithoutRefereeCategory", () => {
  it("includes scheduled upcoming matches without confirmed referee", () => {
    const category = buildMatchesWithoutRefereeCategory(
      ORG,
      [baseMatch],
      NOW,
      WINDOW_END
    );

    assert.equal(category.totalCount, 1);
    assert.match(category.items[0]?.href ?? "", /partidos\/match-1$/);
  });

  it("excludes matches that already have a confirmed referee", () => {
    const category = buildMatchesWithoutRefereeCategory(
      ORG,
      [{ ...baseMatch, hasConfirmedReferee: true }],
      NOW,
      WINDOW_END
    );

    assert.equal(category.totalCount, 0);
  });
});

describe("buildResultsNotCapturedCategory", () => {
  it("includes scheduled matches past estimated end time", () => {
    const category = buildResultsNotCapturedCategory(
      ORG,
      [
        {
          ...baseMatch,
          startsAt: "2026-09-27T18:00:00.000Z",
          hasConfirmedReferee: true,
        },
      ],
      WINDOW_END,
      NOW
    );

    assert.equal(category.totalCount, 1);
    assert.match(category.items[0]?.href ?? "", /captura$/);
  });
});

describe("buildResultsPendingApprovalCategory", () => {
  it("includes finished matches without official approval", () => {
    const category = buildResultsPendingApprovalCategory(ORG, [
      {
        ...baseMatch,
        status: "finished",
        isResultOfficial: false,
      },
    ]);

    assert.equal(category.totalCount, 1);
  });
});

describe("buildOpenDisputesCategory", () => {
  it("maps open disputes to match detail links", () => {
    const disputes: PendingDisputeSource[] = [
      {
        disputeId: "dispute-1",
        matchId: "match-9",
        seasonId: "season-1",
        competitionId: "comp-1",
        homeTeamName: "Halcones",
        awayTeamName: "Leones",
        reason: "Marcador incorrecto",
      },
    ];

    const category = buildOpenDisputesCategory(ORG, disputes);
    assert.equal(category.totalCount, 1);
    assert.match(category.items[0]?.label ?? "", /Halcones vs Leones/);
  });
});

describe("buildTeamsWithBalanceDueCategory", () => {
  it("includes teams with positive balance due", () => {
    const financeRows: PendingFinanceSource[] = [
      {
        seasonTeamId: "st-1",
        seasonId: "season-1",
        competitionId: "comp-1",
        seasonName: "Apertura 2026",
        teamName: "Halcones",
        balanceDue: 850,
      },
    ];

    const category = buildTeamsWithBalanceDueCategory(ORG, financeRows);
    assert.equal(category.totalCount, 1);
    assert.match(category.items[0]?.href ?? "", /finanzas$/);
  });
});

describe("buildPendingTeamRegistrationRequestsCategory", () => {
  it("maps pending registration requests to season review links", () => {
    const rows: PendingTeamRegistrationRequestSource[] = [
      {
        requestId: "req-1",
        seasonId: "season-1",
        competitionId: "comp-1",
        seasonName: "Apertura 2026",
        teamName: "Halcones FC",
        contactName: "Capitán H",
        contactEmail: "capitan@halcones.local",
      },
    ];

    const category = buildPendingTeamRegistrationRequestsCategory(ORG, rows);
    assert.equal(category.id, "pending_team_registration_requests");
    assert.equal(category.totalCount, 1);
    assert.match(category.items[0]?.href ?? "", /inscripciones-equipo$/);
  });
});

describe("buildOrganizationPendingItems", () => {
  it("returns allClear when every category is empty", () => {
    const result = buildOrganizationPendingItems({
      organizationId: ORG,
      matches: [{ ...baseMatch, hasConfirmedReferee: true }],
      disputes: [],
      financeRows: [],
      nowMs: NOW,
      windowStartMs: NOW,
      windowEndMs: WINDOW_END,
    });

    assert.equal(result.allClear, true);
    assert.equal(result.categories.length, 6);
  });

  it("aggregates multiple non-empty categories", () => {
    const result = buildOrganizationPendingItems({
      organizationId: ORG,
      matches: [baseMatch],
      disputes: [
        {
          disputeId: "dispute-1",
          matchId: "match-2",
          seasonId: "season-1",
          competitionId: "comp-1",
          homeTeamName: "A",
          awayTeamName: "B",
          reason: null,
        },
      ],
      financeRows: [
        {
          seasonTeamId: "st-1",
          seasonId: "season-1",
          competitionId: "comp-1",
          seasonName: "Apertura",
          teamName: "Halcones",
          balanceDue: 500,
        },
      ],
      nowMs: NOW,
      windowStartMs: NOW,
      windowEndMs: WINDOW_END,
    });

    assert.equal(result.allClear, false);
    assert.ok(
      result.categories.some((category) => category.totalCount > 0)
    );
  });
});
