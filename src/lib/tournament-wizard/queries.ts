import { createClient } from "@/lib/supabase/server";
import { getSeasonFixtureContext } from "@/lib/fixtures/queries";
import type { WizardContext } from "@/lib/tournament-wizard/types";

export async function getWizardContext(
  organizationId: string,
  competitionId: string,
  seasonId: string
): Promise<WizardContext | null> {
  const supabase = await createClient();

  const { data: season } = await supabase
    .from("seasons")
    .select("id, name, competition_id, organization_id, competitions(name)")
    .eq("id", seasonId)
    .eq("competition_id", competitionId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!season) return null;

  const competition = season.competitions as unknown as { name: string } | null;

  const { data: seasonTeams } = await supabase
    .from("season_teams")
    .select(
      "id, team_id, display_name, teams(name), season_team_players(id)"
    )
    .eq("season_id", seasonId)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  const { data: fields } = await supabase
    .from("fields")
    .select("id, name, address")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  const fixtureCtx = await getSeasonFixtureContext(
    organizationId,
    competitionId,
    seasonId
  );

  return {
    organizationId,
    competitionId,
    seasonId,
    competitionName: competition?.name ?? "Torneo",
    seasonName: season.name,
    fields: (fields ?? []).map((field) => ({
      id: field.id,
      name: field.name,
      address: field.address,
    })),
    teams: (seasonTeams ?? []).map((row) => {
      const team = row.teams as unknown as { name: string } | null;
      const players = row.season_team_players as unknown as Array<{ id: string }>;
      return {
        seasonTeamId: row.id,
        teamId: row.team_id,
        name: row.display_name?.trim() || team?.name || "Equipo",
        playerCount: players?.length ?? 0,
      };
    }),
    fixtureGenerated: (fixtureCtx?.existingMatchCount ?? 0) > 0,
    canGenerateFixture: fixtureCtx?.canGenerate ?? false,
  };
}

export async function getWizardFieldsForSeason(
  organizationId: string,
  competitionId: string,
  seasonId: string
): Promise<Array<{ id: string; name: string; address: string | null }>> {
  const context = await getWizardContext(
    organizationId,
    competitionId,
    seasonId
  );
  return context?.fields ?? [];
}
