import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@ligapro/database";
import {
  normalizePlayerPhoneForSearch,
  type PotentialDuplicatePlayer,
} from "@ligapro/shared/player-duplicate-ui";

import { siteOrigin } from "@/lib/person/site-urls";

function parseOptionalJersey(raw: string): { value: number | null; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { value: null };
  if (!/^\d+$/.test(trimmed)) {
    return { value: null, error: "El dorsal debe ser un número entero positivo." };
  }
  const value = Number(trimmed);
  if (value <= 0) {
    return { value: null, error: "El dorsal debe ser mayor que cero." };
  }
  return { value };
}

export async function updateCaptainJersey(
  supabase: SupabaseClient<Database>,
  seasonTeamPlayerId: string,
  jerseyRaw: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const jersey = parseOptionalJersey(jerseyRaw);
  if (jersey.error) {
    return { ok: false, message: jersey.error };
  }

  const { error } = await supabase.rpc("update_captain_roster_jersey", {
    p_season_team_player_id: seasonTeamPlayerId,
    p_jersey_number: jersey.value,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true };
}

export async function findPotentialDuplicatePlayers(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  phone: string,
): Promise<PotentialDuplicatePlayer[]> {
  const normalized = normalizePlayerPhoneForSearch(phone);
  if (!normalized) {
    return [];
  }

  const { data, error } = await supabase.rpc("find_potential_duplicate_player", {
    p_organization_id: organizationId,
    p_phone: normalized,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    playerId: row.player_id,
    fullName: row.full_name,
    isClaimed: row.is_claimed,
    teamsCount: row.teams_count,
  }));
}

export async function addExistingPlayerToRoster(
  supabase: SupabaseClient<Database>,
  playerId: string,
  seasonTeamId: string,
  jerseyRaw: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const jersey = parseOptionalJersey(jerseyRaw);
  if (jersey.error) {
    return { ok: false, message: jersey.error };
  }

  const { error } = await supabase.rpc("add_existing_player_to_roster", {
    p_player_id: playerId,
    p_season_team_id: seasonTeamId,
    p_jersey_number: jersey.value ?? undefined,
    p_registration_status: "active",
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true };
}

export async function createPlayerAndAddToRoster(
  supabase: SupabaseClient<Database>,
  seasonTeamId: string,
  fullName: string,
  jerseyRaw: string,
  phoneRaw: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const trimmedName = fullName.trim();
  if (trimmedName.length < 2 || trimmedName.length > 100) {
    return {
      ok: false,
      message: "El nombre debe tener entre 2 y 100 caracteres.",
    };
  }

  const jersey = parseOptionalJersey(jerseyRaw);
  if (jersey.error) {
    return { ok: false, message: jersey.error };
  }

  const { error } = await supabase.rpc("create_player_and_add_to_roster", {
    p_season_team_id: seasonTeamId,
    p_full_name: trimmedName,
    p_jersey_number: jersey.value ?? undefined,
    p_registration_status: "active",
    p_phone: phoneRaw.trim() || undefined,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true };
}

async function fetchPendingInvitationToken(
  supabase: SupabaseClient<Database>,
  seasonTeamPlayerId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("captain_invitations")
    .select("token")
    .eq("season_team_player_id", seasonTeamPlayerId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.token ?? null;
}

export async function invitePlayerToClaimProfile(
  supabase: SupabaseClient<Database>,
  seasonTeamPlayerId: string,
  email: string,
): Promise<
  | { ok: true; inviteUrl: string | null }
  | { ok: false; message: string }
> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail.includes("@")) {
    return { ok: false, message: "Indica un correo electrónico válido." };
  }

  const { error } = await supabase.rpc("invite_player_to_roster", {
    p_season_team_player_id: seasonTeamPlayerId,
    p_email: normalizedEmail,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  const token = await fetchPendingInvitationToken(supabase, seasonTeamPlayerId);
  const inviteUrl = token ? `${siteOrigin()}/invitacion/${token}` : null;

  return { ok: true, inviteUrl };
}
