import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { hasCaptainTeamAccess } from "@/lib/auth/get-captain-teams";
import { getSeasonDetails } from "@/lib/competitions/queries";
import { getSeasonTeamRoster } from "@/lib/teams/queries";
import {
  getPlayerCredentialForCaptain,
  getPlayerCredentialForMatchCapture,
} from "@/lib/players/queries";
import { createClient } from "@/lib/supabase/server";

export type SeasonExportContext = {
  userId: string;
  organizationId: string;
  organizationName: string;
  competitionId: string;
  seasonId: string;
  seasonName: string;
  competitionName: string;
};

export async function assertSeasonExportAccess(input: {
  organizationId: string;
  competitionId: string;
  seasonId: string;
}): Promise<SeasonExportContext> {
  const user = await requireUser();
  const membership = await requireOrganizationMembership(
    user.id,
    input.organizationId
  );

  const season = await getSeasonDetails(
    input.organizationId,
    input.competitionId,
    input.seasonId
  );
  if (!season) notFound();

  return {
    userId: user.id,
    organizationId: input.organizationId,
    organizationName: membership.organizationName,
    competitionId: input.competitionId,
    seasonId: input.seasonId,
    seasonName: season.name,
    competitionName: season.competitionName,
  };
}

export async function assertRosterExportAccess(input: {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  seasonTeamId: string;
}) {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role, organizations(name)")
    .eq("profile_id", user.id)
    .eq("organization_id", input.organizationId)
    .maybeSingle();

  const detail = await getSeasonTeamRoster(
    input.organizationId,
    input.competitionId,
    input.seasonId,
    input.seasonTeamId
  );
  if (!detail) notFound();

  const captainAccess = await hasCaptainTeamAccess(user.id, input.seasonTeamId);
  if (!membership && !captainAccess) notFound();

  const orgRel = membership?.organizations as
    | { name: string }
    | { name: string }[]
    | null;
  const org = Array.isArray(orgRel) ? orgRel[0] : orgRel;

  let organizationName = org?.name;
  if (!organizationName) {
    const { data: orgRow } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", input.organizationId)
      .maybeSingle();
    organizationName = orgRow?.name ?? "Organización";
  }

  const { data: rules } = await supabase
    .from("season_rules")
    .select("require_player_verification")
    .eq("season_id", input.seasonId)
    .maybeSingle();

  const { data: rosterRows } = await supabase
    .from("season_team_players")
    .select(
      "jersey_number, is_captain, is_vice_captain, registration_status, players(full_name, verification_status)"
    )
    .eq("season_team_id", input.seasonTeamId)
    .eq("organization_id", input.organizationId)
    .order("jersey_number", { ascending: true, nullsFirst: false });

  return {
    userId: user.id,
    organizationId: input.organizationId,
    organizationName,
    seasonName: detail.seasonName,
    competitionName: detail.competitionName,
    teamName: detail.display_name?.trim() || detail.teamName,
    requirePlayerVerification: rules?.require_player_verification ?? false,
    roster: (rosterRows ?? []).map((row) => {
      const playerRel = row.players as
        | { full_name: string; verification_status: string }
        | { full_name: string; verification_status: string }[]
        | null;
      const player = Array.isArray(playerRel) ? playerRel[0] : playerRel;
      return {
        fullName: player?.full_name ?? "Jugador",
        jerseyNumber: row.jersey_number,
        registrationStatus: row.registration_status,
        verificationStatus: player?.verification_status ?? "not_required",
        isCaptain: row.is_captain,
        isViceCaptain: row.is_vice_captain,
      };
    }),
  };
}

export async function assertCredentialPdfAccess(input:
  | {
      mode: "captain";
      seasonTeamId: string;
      seasonTeamPlayerId: string;
    }
  | {
      mode: "capture";
      organizationId: string;
      competitionId: string;
      seasonId: string;
      matchId: string;
      seasonTeamPlayerId: string;
    }
) {
  const user = await requireUser();

  if (input.mode === "captain") {
    const credential = await getPlayerCredentialForCaptain(
      user.id,
      input.seasonTeamId,
      input.seasonTeamPlayerId
    );
    if (!credential) notFound();
    const supabase = await createClient();
    const [{ data: org }, { data: season }] = await Promise.all([
      supabase
        .from("organizations")
        .select("name")
        .eq("id", credential.organizationId)
        .maybeSingle(),
      supabase
        .from("seasons")
        .select("name, competitions(name)")
        .eq("id", credential.seasonId)
        .maybeSingle(),
    ]);
    const competitionRel = season?.competitions as
      | { name: string }
      | { name: string }[]
      | null;
    const competition = Array.isArray(competitionRel)
      ? competitionRel[0]
      : competitionRel;
    return {
      credential,
      organizationName: org?.name ?? "Organización",
      seasonName: season?.name ?? "Temporada",
      competitionName: competition?.name ?? "Torneo",
    };
  }

  await requireOrganizationMembership(user.id, input.organizationId);
  const credential = await getPlayerCredentialForMatchCapture(
    input.organizationId,
    input.competitionId,
    input.seasonId,
    input.matchId,
    input.seasonTeamPlayerId
  );
  if (!credential) notFound();

  const supabase = await createClient();
  const [{ data: org }, { data: season }] = await Promise.all([
    supabase
      .from("organizations")
      .select("name")
      .eq("id", credential.organizationId)
      .maybeSingle(),
    supabase
      .from("seasons")
      .select("name, competitions(name)")
      .eq("id", credential.seasonId)
      .maybeSingle(),
  ]);
  const competitionRel = season?.competitions as
    | { name: string }
    | { name: string }[]
    | null;
  const competition = Array.isArray(competitionRel)
    ? competitionRel[0]
    : competitionRel;

  return {
    credential,
    organizationName: org?.name ?? "Organización",
    seasonName: season?.name ?? "Temporada",
    competitionName: competition?.name ?? "Torneo",
  };
}
