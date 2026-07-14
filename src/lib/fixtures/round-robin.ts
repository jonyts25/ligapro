export type FixtureTeam = { seasonTeamId: string; name: string };
export type FixtureMode = "single" | "double";
export type GeneratedFixtureMatch = {
  roundNumber: number;
  legNumber: 1 | 2;
  homeSeasonTeamId: string;
  awaySeasonTeamId: string;
  sequenceInRound: number;
};
export type GeneratedFixtureRound = {
  roundNumber: number;
  legNumber: 1 | 2;
  byeSeasonTeamId: string | null;
  matches: GeneratedFixtureMatch[];
};
export type GeneratedFixture = {
  mode: FixtureMode;
  teamCount: number;
  rounds: GeneratedFixtureRound[];
  matches: GeneratedFixtureMatch[];
};

const PHANTOM_SLOT = -1;

function validateTeams(teams: FixtureTeam[]): void {
  if (teams.length < 2) {
    throw new Error("Round-robin fixture requires at least 2 teams");
  }

  const seen = new Set<string>();
  for (const team of teams) {
    if (seen.has(team.seasonTeamId)) {
      throw new Error(
        `Duplicate seasonTeamId in fixture input: ${team.seasonTeamId}`,
      );
    }
    seen.add(team.seasonTeamId);
  }
}

function rotateCircleSlots(slots: number[]): void {
  const last = slots.pop();
  if (last === undefined) {
    return;
  }
  slots.splice(1, 0, last);
}

function generateLeg(
  teams: FixtureTeam[],
  legNumber: 1 | 2,
  startRoundNumber: number,
): { rounds: GeneratedFixtureRound[]; matches: GeneratedFixtureMatch[] } {
  const teamCount = teams.length;
  const isOdd = teamCount % 2 === 1;
  const slotCount = isOdd ? teamCount + 1 : teamCount;
  const roundsPerLeg = isOdd ? teamCount : teamCount - 1;

  const slots: number[] = teams.map((_, index) => index);
  if (isOdd) {
    slots.push(PHANTOM_SLOT);
  }

  const rounds: GeneratedFixtureRound[] = [];
  const matches: GeneratedFixtureMatch[] = [];

  for (let roundIndex = 0; roundIndex < roundsPerLeg; roundIndex++) {
    const roundNumber = startRoundNumber + roundIndex;
    const roundMatches: GeneratedFixtureMatch[] = [];
    let byeSeasonTeamId: string | null = null;
    let sequenceInRound = 1;

    for (let pairIndex = 0; pairIndex < slotCount / 2; pairIndex++) {
      const homeIndex = slots[pairIndex];
      const awayIndex = slots[slotCount - 1 - pairIndex];

      if (homeIndex === PHANTOM_SLOT) {
        byeSeasonTeamId = teams[awayIndex].seasonTeamId;
        continue;
      }
      if (awayIndex === PHANTOM_SLOT) {
        byeSeasonTeamId = teams[homeIndex].seasonTeamId;
        continue;
      }

      let homeSeasonTeamId = teams[homeIndex].seasonTeamId;
      let awaySeasonTeamId = teams[awayIndex].seasonTeamId;

      if (legNumber === 2) {
        [homeSeasonTeamId, awaySeasonTeamId] = [
          awaySeasonTeamId,
          homeSeasonTeamId,
        ];
      }

      const match: GeneratedFixtureMatch = {
        roundNumber,
        legNumber,
        homeSeasonTeamId,
        awaySeasonTeamId,
        sequenceInRound,
      };
      sequenceInRound += 1;
      roundMatches.push(match);
    }

    rounds.push({
      roundNumber,
      legNumber,
      byeSeasonTeamId,
      matches: roundMatches,
    });
    matches.push(...roundMatches);

    if (roundIndex < roundsPerLeg - 1) {
      rotateCircleSlots(slots);
    }
  }

  return { rounds, matches };
}

function buildSecondLegFromFirst(
  firstLegRounds: GeneratedFixtureRound[],
): { rounds: GeneratedFixtureRound[]; matches: GeneratedFixtureMatch[] } {
  const rounds: GeneratedFixtureRound[] = [];
  const matches: GeneratedFixtureMatch[] = [];
  const roundOffset = firstLegRounds.length;

  for (const round of firstLegRounds) {
    const roundNumber = round.roundNumber + roundOffset;
    const roundMatches = round.matches.map((match) => ({
      roundNumber,
      legNumber: 2 as const,
      homeSeasonTeamId: match.awaySeasonTeamId,
      awaySeasonTeamId: match.homeSeasonTeamId,
      sequenceInRound: match.sequenceInRound,
    }));

    rounds.push({
      roundNumber,
      legNumber: 2,
      byeSeasonTeamId: round.byeSeasonTeamId,
      matches: roundMatches,
    });
    matches.push(...roundMatches);
  }

  return { rounds, matches };
}

export function generateRoundRobinFixture(
  teams: FixtureTeam[],
  mode: FixtureMode,
): GeneratedFixture {
  validateTeams(teams);

  const firstLeg = generateLeg(teams, 1, 1);

  if (mode === "single") {
    return {
      mode,
      teamCount: teams.length,
      rounds: firstLeg.rounds,
      matches: firstLeg.matches,
    };
  }

  const secondLeg = buildSecondLegFromFirst(firstLeg.rounds);

  return {
    mode,
    teamCount: teams.length,
    rounds: [...firstLeg.rounds, ...secondLeg.rounds],
    matches: [...firstLeg.matches, ...secondLeg.matches],
  };
}

export function fixtureToJsonPayload(matches: GeneratedFixtureMatch[]) {
  return matches.map((match) => ({
    round_number: match.roundNumber,
    leg_number: match.legNumber,
    home_season_team_id: match.homeSeasonTeamId,
    away_season_team_id: match.awaySeasonTeamId,
    sequence_in_round: match.sequenceInRound,
  }));
}
