import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildChroniclePrompt } from "@/lib/chronicles/build-prompt";
import type { MatchTimelineEvent } from "@/lib/matches/types";

const baseEvent = {
  notes: null,
  createdAt: "2026-01-01T00:00:00Z",
  voidedAt: null,
  voidReason: null,
};

describe("buildChroniclePrompt", () => {
  it("includes running score after each goal and local/visitante labels", () => {
    const events: MatchTimelineEvent[] = [
      {
        ...baseEvent,
        id: "1",
        eventType: "goal",
        minute: 10,
        playerName: "Juan",
        teamName: "Local FC",
        seasonTeamId: "home-st",
        seasonTeamPlayerId: "stp-1",
      },
      {
        ...baseEvent,
        id: "2",
        eventType: "goal",
        minute: 20,
        playerName: "Pedro",
        teamName: "Visit FC",
        seasonTeamId: "away-st",
        seasonTeamPlayerId: "stp-2",
      },
      {
        ...baseEvent,
        id: "3",
        eventType: "goal",
        minute: 30,
        playerName: "Juan",
        teamName: "Local FC",
        seasonTeamId: "home-st",
        seasonTeamPlayerId: "stp-1",
      },
    ];

    const prompt = buildChroniclePrompt({
      homeTeamName: "Local FC",
      awayTeamName: "Visit FC",
      homeSeasonTeamId: "home-st",
      awaySeasonTeamId: "away-st",
      homeScore: 2,
      awayScore: 1,
      events,
    });

    assert.match(prompt, /EQUIPO LOCAL/);
    assert.match(
      prompt,
      /marcador tras este gol: Local FC 1 - 0 Visit FC/
    );
    assert.match(
      prompt,
      /marcador tras este gol: Local FC 1 - 1 Visit FC/
    );
    assert.match(prompt, /su SEGUNDO gol del partido/);
    assert.match(prompt, /\{"cronica":/);
  });

  it("ignores voided events", () => {
    const prompt = buildChroniclePrompt({
      homeTeamName: "A",
      awayTeamName: "B",
      homeSeasonTeamId: "home-st",
      awaySeasonTeamId: "away-st",
      homeScore: 0,
      awayScore: 0,
      events: [
        {
          ...baseEvent,
          id: "1",
          eventType: "goal",
          minute: 5,
          playerName: "Void",
          teamName: "A",
          seasonTeamId: "home-st",
          seasonTeamPlayerId: "stp-1",
          voidedAt: "2026-01-02T00:00:00Z",
        },
      ],
    });

    assert.match(prompt, /Sin goles registrados/);
  });
});
