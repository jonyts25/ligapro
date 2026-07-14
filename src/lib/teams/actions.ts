"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import {
  ROSTER_STATUS_OPTIONS,
  SEASON_TEAM_STATUS_OPTIONS,
  type RosterRegistrationStatus,
  type SeasonTeamRegistrationStatus,
  type TeamsActionState,
} from "@/lib/teams/types";
import {
  isSeasonRosterSeatConflict,
  seasonRosterSeatConflictMessage,
} from "@/lib/teams/roster-errors";

function validateName(name: string, label: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 100) {
    return `El ${label} debe tener entre 2 y 100 caracteres.`;
  }
  return null;
}

function isSeasonTeamStatus(
  value: string
): value is SeasonTeamRegistrationStatus {
  return SEASON_TEAM_STATUS_OPTIONS.some((o) => o.value === value);
}

function isRosterStatus(value: string): value is RosterRegistrationStatus {
  return ROSTER_STATUS_OPTIONS.some((o) => o.value === value);
}

function parseOptionalJersey(
  raw: string
): { value: number | null; error?: string } {
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

async function revalidateTeamPaths(
  organizationId: string,
  opts?: {
    teamId?: string;
    competitionId?: string;
    seasonId?: string;
    seasonTeamId?: string;
  }
) {
  revalidatePath(`/organizaciones/${organizationId}/equipos`);
  revalidatePath(`/organizaciones/${organizationId}/inicio`);
  if (opts?.teamId) {
    revalidatePath(`/organizaciones/${organizationId}/equipos/${opts.teamId}`);
    revalidatePath(
      `/organizaciones/${organizationId}/equipos/${opts.teamId}/editar`
    );
  }
  if (opts?.competitionId && opts.seasonId) {
    const base = `/organizaciones/${organizationId}/torneos/${opts.competitionId}/temporadas/${opts.seasonId}`;
    revalidatePath(base);
    revalidatePath(`${base}/equipos`);
    revalidatePath(`${base}/equipos/inscribir`);
    revalidatePath(`${base}/calendario`);
    revalidatePath(`${base}/posiciones`);
    revalidatePath(`${base}/goleadores`);
    revalidatePath(`${base}/disciplina`);
    if (opts.seasonTeamId) {
      revalidatePath(`${base}/equipos/${opts.seasonTeamId}`);
    }

    const supabase = await createClient();
    const { data: season } = await supabase
      .from("seasons")
      .select("slug")
      .eq("id", opts.seasonId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (season?.slug) {
      const publicBase = `/publico/${organizationId}/${season.slug}`;
      revalidatePath(publicBase);
      revalidatePath(`${publicBase}/calendario`);
      revalidatePath(`${publicBase}/posiciones`);
      revalidatePath(`${publicBase}/goleadores`);
      revalidatePath(`${publicBase}/disciplina`);
    }
  }
}

async function revalidateStandingsSurfacesForTeam(
  organizationId: string,
  teamId: string
) {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("season_teams")
    .select("season_id, seasons!inner(id, slug, competition_id, organization_id)")
    .eq("team_id", teamId)
    .eq("organization_id", organizationId);

  for (const row of rows ?? []) {
    const season = row.seasons as unknown as {
      id: string;
      slug: string;
      competition_id: string;
      organization_id: string;
    } | null;
    if (!season?.competition_id || !season?.id) continue;
    const base = `/organizaciones/${organizationId}/torneos/${season.competition_id}/temporadas/${season.id}`;
    revalidatePath(`${base}/posiciones`);
    revalidatePath(`${base}/calendario`);
    revalidatePath(`${base}/goleadores`);
    if (season.slug) {
      const publicBase = `/publico/${organizationId}/${season.slug}`;
      revalidatePath(publicBase);
      revalidatePath(`${publicBase}/posiciones`);
      revalidatePath(`${publicBase}/calendario`);
      revalidatePath(`${publicBase}/goleadores`);
    }
  }
}

export async function createTeamAction(
  _prev: TeamsActionState,
  formData: FormData
): Promise<TeamsActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  await requireOrganizationAdmin(user.id, organizationId);

  const name = String(formData.get("name") ?? "");
  const nameError = validateName(name, "nombre del equipo");
  if (nameError) {
    return {
      ok: false,
      message: nameError,
      fieldErrors: { name: nameError },
      values: { name },
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teams")
    .insert({ organization_id: organizationId, name: name.trim() })
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false,
      message: "No pudimos crear el equipo. Inténtalo nuevamente.",
      values: { name },
    };
  }

  await revalidateTeamPaths(organizationId, { teamId: data.id });
  redirect(`/organizaciones/${organizationId}/equipos/${data.id}`);
}

export async function updateTeamAction(
  _prev: TeamsActionState,
  formData: FormData
): Promise<TeamsActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  await requireOrganizationAdmin(user.id, organizationId);

  const name = String(formData.get("name") ?? "");
  const nameError = validateName(name, "nombre del equipo");
  if (nameError) {
    return {
      ok: false,
      message: nameError,
      fieldErrors: { name: nameError },
      values: { name },
    };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("teams")
    .select("id")
    .eq("id", teamId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!existing) {
    return { ok: false, message: "No encontramos el equipo." };
  }

  const { error } = await supabase
    .from("teams")
    .update({ name: name.trim() })
    .eq("id", teamId)
    .eq("organization_id", organizationId);

  if (error) {
    return {
      ok: false,
      message: "No pudimos guardar el equipo. Inténtalo nuevamente.",
      values: { name },
    };
  }

  await revalidateTeamPaths(organizationId, { teamId });
  await revalidateStandingsSurfacesForTeam(organizationId, teamId);
  return {
    ok: true,
    message: "Equipo actualizado correctamente.",
    values: { name: name.trim() },
  };
}

export async function enrollTeamAction(
  _prev: TeamsActionState,
  formData: FormData
): Promise<TeamsActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  await requireOrganizationAdmin(user.id, organizationId);

  const displayName = String(formData.get("displayName") ?? "").trim();
  const groupName = String(formData.get("groupName") ?? "").trim();
  const registrationStatus = String(
    formData.get("registrationStatus") ?? "registered"
  );

  const values = {
    teamId,
    displayName,
    groupName,
    registrationStatus,
  };

  if (!teamId) {
    return {
      ok: false,
      message: "Selecciona un equipo.",
      fieldErrors: { teamId: "Selecciona un equipo." },
      values,
    };
  }
  if (!isSeasonTeamStatus(registrationStatus)) {
    return {
      ok: false,
      message: "Estado de inscripción inválido.",
      fieldErrors: { registrationStatus: "Estado inválido." },
      values,
    };
  }

  const supabase = await createClient();
  const { data: season } = await supabase
    .from("seasons")
    .select("id")
    .eq("id", seasonId)
    .eq("competition_id", competitionId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!season) {
    return { ok: false, message: "No encontramos la temporada." };
  }

  const { data: seasonTeamId, error } = await supabase.rpc(
    "enroll_team_in_season",
    {
      p_season_id: seasonId,
      p_team_id: teamId,
      p_display_name: displayName || undefined,
      p_group_name: groupName || undefined,
      p_registration_status: registrationStatus,
    }
  );

  if (error || !seasonTeamId) {
    const duplicate =
      error?.message?.toLowerCase().includes("unique") ||
      error?.code === "23505";
    return {
      ok: false,
      message: duplicate
        ? "Ese equipo ya está inscrito en esta temporada."
        : "No pudimos inscribir el equipo. Inténtalo nuevamente.",
      values,
    };
  }

  await revalidateTeamPaths(organizationId, {
    teamId,
    competitionId,
    seasonId,
    seasonTeamId,
  });
  redirect(
    `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}/equipos/${seasonTeamId}`
  );
}

export async function createPlayerAndAddAction(
  _prev: TeamsActionState,
  formData: FormData
): Promise<TeamsActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const seasonTeamId = String(formData.get("seasonTeamId") ?? "");
  await requireOrganizationAdmin(user.id, organizationId);

  const fullName = String(formData.get("fullName") ?? "");
  const jerseyRaw = String(formData.get("jerseyNumber") ?? "");
  const values = { fullName, jerseyNumber: jerseyRaw, mode: "create" };

  const nameError = validateName(fullName, "nombre del jugador");
  if (nameError) {
    return {
      ok: false,
      message: nameError,
      fieldErrors: { fullName: nameError },
      values,
    };
  }

  const jersey = parseOptionalJersey(jerseyRaw);
  if (jersey.error) {
    return {
      ok: false,
      message: jersey.error,
      fieldErrors: { jerseyNumber: jersey.error },
      values,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_player_and_add_to_roster", {
    p_season_team_id: seasonTeamId,
    p_full_name: fullName.trim(),
    p_jersey_number: jersey.value ?? undefined,
    p_registration_status: "active",
  });

  if (error) {
    return {
      ok: false,
      message: isSeasonRosterSeatConflict(error)
        ? seasonRosterSeatConflictMessage()
        : "No pudimos agregar al jugador. Revisa el dorsal e inténtalo de nuevo.",
      values,
    };
  }

  await revalidateTeamPaths(organizationId, {
    competitionId,
    seasonId,
    seasonTeamId,
  });
  return {
    ok: true,
    message: "Jugador creado y agregado al plantel.",
    values: { fullName: "", jerseyNumber: "", mode: "create" },
  };
}

export async function addExistingPlayerAction(
  _prev: TeamsActionState,
  formData: FormData
): Promise<TeamsActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const seasonTeamId = String(formData.get("seasonTeamId") ?? "");
  await requireOrganizationAdmin(user.id, organizationId);

  const playerId = String(formData.get("playerId") ?? "");
  const jerseyRaw = String(formData.get("jerseyNumber") ?? "");
  const values = { playerId, jerseyNumber: jerseyRaw, mode: "existing" };

  if (!playerId) {
    return {
      ok: false,
      message: "Selecciona un jugador.",
      fieldErrors: { playerId: "Selecciona un jugador." },
      values,
    };
  }

  const jersey = parseOptionalJersey(jerseyRaw);
  if (jersey.error) {
    return {
      ok: false,
      message: jersey.error,
      fieldErrors: { jerseyNumber: jersey.error },
      values,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_player_to_season_team", {
    p_season_team_id: seasonTeamId,
    p_player_id: playerId,
    p_jersey_number: jersey.value ?? undefined,
    p_registration_status: "active",
  });

  if (error) {
    const already =
      error.message?.toLowerCase().includes("already on this roster") ?? false;

    let occupiedName: string | null = null;
    if (isSeasonRosterSeatConflict(error)) {
      const { data: occupied } = await supabase
        .from("season_team_players")
        .select(
          "season_team_id, season_teams(display_name, teams(name))"
        )
        .eq("organization_id", organizationId)
        .eq("season_id", seasonId)
        .eq("player_id", playerId)
        .in("registration_status", ["active", "suspended"])
        .neq("season_team_id", seasonTeamId)
        .maybeSingle();

      const stRel = occupied?.season_teams as
        | {
            display_name: string | null;
            teams: { name: string } | { name: string }[] | null;
          }
        | {
            display_name: string | null;
            teams: { name: string } | { name: string }[] | null;
          }[]
        | null
        | undefined;
      const st = Array.isArray(stRel) ? stRel[0] : stRel;
      const teamRel = st?.teams;
      const teamName = Array.isArray(teamRel)
        ? teamRel[0]?.name
        : teamRel?.name;
      occupiedName = st?.display_name?.trim() || teamName || null;
    }

    return {
      ok: false,
      message: isSeasonRosterSeatConflict(error)
        ? seasonRosterSeatConflictMessage(occupiedName)
        : already
          ? "Ese jugador ya está activo en este plantel."
          : "No pudimos agregar al jugador. Inténtalo nuevamente.",
      values,
    };
  }

  await revalidateTeamPaths(organizationId, {
    competitionId,
    seasonId,
    seasonTeamId,
  });
  return {
    ok: true,
    message: "Jugador agregado al plantel.",
    values: { playerId: "", jerseyNumber: "", mode: "existing" },
  };
}

export async function updateRosterEntryAction(
  _prev: TeamsActionState,
  formData: FormData
): Promise<TeamsActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const seasonTeamId = String(formData.get("seasonTeamId") ?? "");
  const rosterId = String(formData.get("rosterId") ?? "");
  await requireOrganizationAdmin(user.id, organizationId);

  const jerseyRaw = String(formData.get("jerseyNumber") ?? "");
  const registrationStatus = String(
    formData.get("registrationStatus") ?? "active"
  );

  if (!isRosterStatus(registrationStatus)) {
    return { ok: false, message: "Estado de plantel inválido." };
  }

  const jersey = parseOptionalJersey(jerseyRaw);
  if (jersey.error) {
    return {
      ok: false,
      message: jersey.error,
      fieldErrors: { jerseyNumber: jersey.error },
    };
  }

  const supabase = await createClient();
  const { data: entry } = await supabase
    .from("season_team_players")
    .select("id")
    .eq("id", rosterId)
    .eq("season_team_id", seasonTeamId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!entry) {
    return { ok: false, message: "No encontramos al jugador en el plantel." };
  }

  const { error: statusError } = await supabase.rpc(
    "set_season_team_player_status",
    {
      p_season_team_player_id: rosterId,
      p_registration_status: registrationStatus,
    }
  );

  if (statusError) {
    return {
      ok: false,
      message: isSeasonRosterSeatConflict(statusError)
        ? seasonRosterSeatConflictMessage()
        : "No pudimos actualizar el estado del plantel.",
    };
  }

  const { error: jerseyError } = await supabase
    .from("season_team_players")
    .update({ jersey_number: jersey.value })
    .eq("id", rosterId)
    .eq("organization_id", organizationId);

  if (jerseyError) {
    return {
      ok: false,
      message: "El estado se actualizó, pero no pudimos guardar el dorsal.",
    };
  }

  await revalidateTeamPaths(organizationId, {
    competitionId,
    seasonId,
    seasonTeamId,
  });
  return { ok: true, message: "Participación actualizada." };
}

export async function setRosterStatusAction(
  _prev: TeamsActionState,
  formData: FormData
): Promise<TeamsActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const seasonTeamId = String(formData.get("seasonTeamId") ?? "");
  const rosterId = String(formData.get("rosterId") ?? "");
  await requireOrganizationAdmin(user.id, organizationId);

  const registrationStatus = String(
    formData.get("registrationStatus") ?? "active"
  );

  if (!isRosterStatus(registrationStatus)) {
    return { ok: false, message: "Estado de plantel inválido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_season_team_player_status", {
    p_season_team_player_id: rosterId,
    p_registration_status: registrationStatus,
  });

  if (error) {
    return {
      ok: false,
      message: isSeasonRosterSeatConflict(error)
        ? seasonRosterSeatConflictMessage()
        : "No pudimos actualizar el estado del plantel.",
    };
  }

  await revalidateTeamPaths(organizationId, {
    competitionId,
    seasonId,
    seasonTeamId,
  });

  const label =
    ROSTER_STATUS_OPTIONS.find((o) => o.value === registrationStatus)?.label ??
    registrationStatus;

  return {
    ok: true,
    message:
      registrationStatus === "inactive"
        ? "Jugador marcado como inactivo. Ya puede inscribirse en otro equipo de esta temporada."
        : `Estado actualizado: ${label}.`,
  };
}

export async function deactivateRosterPlayerAction(
  _prev: TeamsActionState,
  formData: FormData
): Promise<TeamsActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const seasonTeamId = String(formData.get("seasonTeamId") ?? "");
  const rosterId = String(formData.get("rosterId") ?? "");
  await requireOrganizationAdmin(user.id, organizationId);

  const supabase = await createClient();
  const { error } = await supabase.rpc("deactivate_season_team_player", {
    p_season_team_player_id: rosterId,
  });

  if (error) {
    return {
      ok: false,
      message: "No pudimos retirar al jugador del plantel.",
    };
  }

  await revalidateTeamPaths(organizationId, {
    competitionId,
    seasonId,
    seasonTeamId,
  });
  return {
    ok: true,
    message:
      "Jugador retirado del plantel. Su ficha permanece en la organización.",
  };
}

export async function setCaptainAction(
  _prev: TeamsActionState,
  formData: FormData
): Promise<TeamsActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const seasonTeamId = String(formData.get("seasonTeamId") ?? "");
  const playerId = String(formData.get("playerId") ?? "");
  await requireOrganizationAdmin(user.id, organizationId);

  if (!playerId) {
    return { ok: false, message: "Selecciona un jugador del plantel." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_season_team_captain", {
    p_season_team_id: seasonTeamId,
    p_player_id: playerId,
  });

  if (error) {
    return {
      ok: false,
      message:
        "No pudimos asignar al capitán. Debe estar activo en este plantel.",
    };
  }

  await revalidateTeamPaths(organizationId, {
    competitionId,
    seasonId,
    seasonTeamId,
  });
  return { ok: true, message: "Capitán actualizado." };
}
