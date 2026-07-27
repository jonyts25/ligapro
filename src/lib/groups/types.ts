export type SeasonGroupRow = {
  id: string;
  name: string;
};

export type GroupTeamRow = {
  seasonTeamId: string;
  teamName: string;
  registrationStatus: string;
  seasonGroupId: string | null;
  groupName: string | null;
};

export type GroupFixtureStatus = {
  groupId: string;
  groupName: string;
  teamCount: number;
  matchCount: number;
  unfinishedCount: number;
  hasFixture: boolean;
};

export type GroupsPhaseData = {
  groups: SeasonGroupRow[];
  teams: GroupTeamRow[];
  groupsAdvancePerGroup: number | null;
  fixtureStatus: GroupFixtureStatus[];
  hasKnockoutBracket: boolean;
};

export type GroupsActionState = {
  ok: boolean;
  message: string | null;
  details?: string[];
};

export const initialGroupsActionState: GroupsActionState = {
  ok: false,
  message: null,
};

export type GroupFixtureResult = {
  groupId: string;
  groupName: string;
  ok: boolean;
  message: string;
};
