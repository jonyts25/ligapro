import { createClient } from "@/lib/supabase/server";
import { hasCaptainTeamAccess } from "@/lib/auth/get-captain-teams";
import { resolvePlayerPhotoUrl } from "@/lib/players/photo-url";
import type { PlayerCredentialData } from "@/lib/players/types";

async function fetchRosterPlayerRow(seasonTeamPlayerId: string) {
  const supabase = await createClient();
  return supabase
    .from("season_team_players")
    .select(
      "id, player_id, organization_id, season_id, season_team_id, jersey_number, season_teams(display_name, teams(name)), players(full_name, photo_path, verification_status), seasons(season_rules(require_player_verification))"
    )
    .eq("id", seasonTeamPlayerId)
    .maybeSingle();
}

function parseRosterRow(
  row: NonNullable<Awaited<ReturnType<typeof fetchRosterPlayerRow>>["data"]>
) {
  const playerRel = row.players as
    | {
        full_name: string;
        photo_path: string | null;
        verification_status: string;
      }
    | {
        full_name: string;
        photo_path: string | null;
        verification_status: string;
      }[]
    | null;
  const player = Array.isArray(playerRel) ? playerRel[0] : playerRel;

  const stRel = row.season_teams as
    | {
        display_name: string | null;
        teams: { name: string } | { name: string }[] | null;
      }
    | {
        display_name: string | null;
        teams: { name: string } | { name: string }[] | null;
      }[]
    | null;
  const seasonTeam = Array.isArray(stRel) ? stRel[0] : stRel;
  const teamRel = seasonTeam?.teams;
  const team = Array.isArray(teamRel) ? teamRel[0] : teamRel;

  const seasonRel = row.seasons as
    | {
        season_rules:
          | { require_player_verification: boolean }
          | { require_player_verification: boolean }[]
          | null;
      }
    | {
        season_rules:
          | { require_player_verification: boolean }
          | { require_player_verification: boolean }[]
          | null;
      }[]
    | null;
  const season = Array.isArray(seasonRel) ? seasonRel[0] : seasonRel;
  const rulesRel = season?.season_rules;
  const rules = Array.isArray(rulesRel) ? rulesRel[0] : rulesRel;

  return {
    player,
    teamName: seasonTeam?.display_name ?? team?.name ?? "Equipo",
    requirePlayerVerification: rules?.require_player_verification ?? false,
  };
}

async function assertCanViewPlayerPhoto(playerId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("can_view_player_photo", {
    p_player_id: playerId,
  });
  return Boolean(data);
}

export async function getPlayerCredentialForMatchCapture(
  organizationId: string,
  competitionId: string,
  seasonId: string,
  matchId: string,
  seasonTeamPlayerId: string
): Promise<PlayerCredentialData | null> {
  const supabase = await createClient();

  const { data: match } = await supabase
    .from("matches")
    .select("id, home_season_team_id, away_season_team_id, season_id")
    .eq("id", matchId)
    .eq("organization_id", organizationId)
    .eq("season_id", seasonId)
    .maybeSingle();

  if (!match) return null;

  const { data: season } = await supabase
    .from("seasons")
    .select("competition_id")
    .eq("id", seasonId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!season || season.competition_id !== competitionId) return null;

  const { data: row } = await fetchRosterPlayerRow(seasonTeamPlayerId);
  if (!row || row.organization_id !== organizationId) return null;

  const onMatch =
    row.season_team_id === match.home_season_team_id ||
    row.season_team_id === match.away_season_team_id;
  if (!onMatch) return null;

  if (!(await assertCanViewPlayerPhoto(row.player_id))) return null;

  const parsed = parseRosterRow(row);
  const photoUrl = await resolvePlayerPhotoUrl(parsed.player?.photo_path ?? null);

  return {
    seasonTeamPlayerId: row.id,
    playerId: row.player_id,
    organizationId: row.organization_id,
    seasonId: row.season_id,
    fullName: parsed.player?.full_name ?? "Jugador",
    jerseyNumber: row.jersey_number,
    teamName: parsed.teamName,
    photoPath: parsed.player?.photo_path ?? null,
    photoUrl,
    verificationStatus: parsed.player?.verification_status ?? "not_required",
    requirePlayerVerification: parsed.requirePlayerVerification,
    canUploadPhoto: false,
  };
}

export async function getPlayerCredentialForCaptain(
  profileId: string,
  seasonTeamId: string,
  seasonTeamPlayerId: string
): Promise<PlayerCredentialData | null> {
  const allowed = await hasCaptainTeamAccess(profileId, seasonTeamId);
  const supabase = await createClient();

  const { data: row } = await fetchRosterPlayerRow(seasonTeamPlayerId);
  if (!row || row.season_team_id !== seasonTeamId) return null;

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", row.organization_id)
    .eq("profile_id", profileId)
    .maybeSingle();

  const isAdmin =
    membership?.role === "organization_owner" ||
    membership?.role === "organization_admin";

  if (!allowed && !isAdmin) {
    if (!(await assertCanViewPlayerPhoto(row.player_id))) return null;
  } else if (!(await assertCanViewPlayerPhoto(row.player_id))) {
    return null;
  }

  const parsed = parseRosterRow(row);
  const photoUrl = await resolvePlayerPhotoUrl(parsed.player?.photo_path ?? null);

  return {
    seasonTeamPlayerId: row.id,
    playerId: row.player_id,
    organizationId: row.organization_id,
    seasonId: row.season_id,
    fullName: parsed.player?.full_name ?? "Jugador",
    jerseyNumber: row.jersey_number,
    teamName: parsed.teamName,
    photoPath: parsed.player?.photo_path ?? null,
    photoUrl,
    verificationStatus: parsed.player?.verification_status ?? "not_required",
    requirePlayerVerification: parsed.requirePlayerVerification,
    canUploadPhoto: isAdmin || allowed,
  };
}
