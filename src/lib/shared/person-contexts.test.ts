import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getPersonContexts,
  mapAdminOrganizationRows,
  mapPlayerTeamRows,
  type PersonContexts,
} from "./person-contexts";

describe("person-contexts mappers", () => {
  it("mapAdminOrganizationRows deduplicates organizations", () => {
    const rows = mapAdminOrganizationRows([
      {
        role: "organization_owner",
        organizations: { id: "org-1", name: "Liga Norte", slug: "liga-norte" },
      },
      {
        role: "organization_admin",
        organizations: { id: "org-1", name: "Liga Norte", slug: "liga-norte" },
      },
    ]);

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.slug, "liga-norte");
  });

  it("mapPlayerTeamRows maps captain flags and nested labels", () => {
    const rows = mapPlayerTeamRows([
      {
        id: "stp-1",
        season_team_id: "st-1",
        player_id: "player-1",
        is_captain: true,
        is_vice_captain: false,
        season_teams: {
          display_name: null,
          organization_id: "org-1",
          teams: { name: "Halcones" },
          organizations: { name: "Org Uno", slug: "org-uno" },
          seasons: {
            name: "Apertura 2026",
            slug: "apertura-2026",
            competitions: { name: "Liga Mayor" },
          },
        },
      },
    ]);

    assert.equal(rows[0]?.teamName, "Halcones");
    assert.equal(rows[0]?.isCaptain, true);
    assert.equal(rows[0]?.seasonSlug, "apertura-2026");
  });
});

type QueryResult = { data: unknown; error: null | { message: string } };

function createMockSupabase(handlers: {
  organizationMembers?: QueryResult;
  players?: QueryResult;
  seasonTeamPlayers?: QueryResult;
  matchOfficials?: QueryResult;
  matches?: QueryResult;
  seasonTeams?: QueryResult;
  fieldReservations?: QueryResult;
}): unknown {
  const fromHandlers: Record<string, () => QueryResult> = {
    organization_members: () =>
      handlers.organizationMembers ?? { data: [], error: null },
    players: () => handlers.players ?? { data: [], error: null },
    season_team_players: () =>
      handlers.seasonTeamPlayers ?? { data: [], error: null },
    match_officials: () =>
      handlers.matchOfficials ?? { data: [], error: null },
    matches: () => handlers.matches ?? { data: [], error: null },
    season_teams: () => handlers.seasonTeams ?? { data: [], error: null },
    field_reservations: () =>
      handlers.fieldReservations ?? { data: [], error: null },
  };

  function makeBuilder(table: string) {
    const state = { table, filters: [] as string[] };
    const builder = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      or: () => builder,
      then(onFulfilled: (value: QueryResult) => unknown) {
        const handler = fromHandlers[state.table];
        return Promise.resolve(
          onFulfilled(handler ? handler() : { data: [], error: null })
        );
      },
    };
    return builder;
  }

  return { from: makeBuilder };
}

describe("getPersonContexts", () => {
  it("groups admin, official matches and player teams together", async () => {
    const supabase = createMockSupabase({
      organizationMembers: {
        data: [
          {
            role: "organization_owner",
            organizations: {
              id: "org-admin",
              name: "Admin Org",
              slug: "admin-org",
            },
          },
        ],
        error: null,
      },
      players: {
        data: [{ id: "player-cap" }],
        error: null,
      },
      seasonTeamPlayers: {
        data: [
          {
            id: "stp-cap",
            season_team_id: "st-cap",
            player_id: "player-cap",
            is_captain: true,
            is_vice_captain: false,
            season_teams: {
              display_name: "Capitanes FC",
              organization_id: "org-player",
              teams: { name: "Capitanes" },
              organizations: { name: "Player Org", slug: "player-org" },
              seasons: {
                name: "Clausura",
                slug: "clausura",
                competitions: { name: "Copa" },
              },
            },
          },
        ],
        error: null,
      },
      matchOfficials: {
        data: [
          {
            id: "mo-1",
            match_id: "match-1",
            role: "referee",
            status: "confirmed",
            organization_id: "org-official",
          },
        ],
        error: null,
      },
      matches: {
        data: [
          {
            id: "match-1",
            organization_id: "org-official",
            season_id: "season-1",
            home_season_team_id: "st-home",
            away_season_team_id: "st-away",
            field_reservation_id: null,
            seasons: {
              id: "season-1",
              competition_id: "comp-1",
              visibility: "public",
              name: "Temporada 1",
              competitions: { name: "Liga" },
            },
          },
        ],
        error: null,
      },
      seasonTeams: {
        data: [
          {
            id: "st-home",
            display_name: null,
            teams: { name: "Local" },
          },
          {
            id: "st-away",
            display_name: null,
            teams: { name: "Visitante" },
          },
        ],
        error: null,
      },
    });

    const contexts: PersonContexts = await getPersonContexts(
      supabase,
      "profile-1"
    );

    assert.equal(contexts.organizacionesAdmin.length, 1);
    assert.equal(contexts.organizacionesAdmin[0]?.slug, "admin-org");
    assert.equal(contexts.partidosPorArbitrar.length, 1);
    assert.equal(contexts.partidosPorArbitrar[0]?.matchId, "match-1");
    assert.equal(contexts.equiposComoJugador.length, 1);
    assert.equal(contexts.equiposComoJugador[0]?.isCaptain, true);
    assert.equal(contexts.equiposComoJugador[0]?.organizationSlug, "player-org");
  });
});
