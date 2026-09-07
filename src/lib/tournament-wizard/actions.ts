"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import {
  assertCanCreateCompetition,
  assertCanCreateField,
  assertCanCreateVenue,
  getOrganizationTierLimitStatus,
} from "@/lib/billing/tier-limits-queries";
import { slugifySeasonName } from "@/lib/competitions/types";
import {
  fixtureToJsonPayload,
  generateRoundRobinFixture,
} from "@/lib/fixtures/round-robin";
import { getSeasonFixtureContext } from "@/lib/fixtures/queries";
import {
  bulkPlayerEntriesForRpc,
  hasDuplicateJerseyNumbers,
  parseBulkPlayerLines,
  parseBulkTeamNames,
} from "@/lib/teams/parse-bulk-players";
import {
  buildWizardScheduleForFields,
  defaultWizardFieldCount,
  wizardStepHref,
} from "@/lib/tournament-wizard/schedule";
import type {
  TournamentWizardActionState,
  WizardPlayerEntry,
} from "@/lib/tournament-wizard/types";
import type { Json } from "@/types/database";

function validateName(name: string, label: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 100) {
    return `El ${label} debe tener entre 2 y 100 caracteres.`;
  }
  return null;
}

function revalidateWizardPaths(
  organizationId: string,
  competitionId?: string,
  seasonId?: string
) {
  revalidatePath(`/organizaciones/${organizationId}/torneos`);
  revalidatePath(`/organizaciones/${organizationId}/torneos/asistente`);
  revalidatePath(`/organizaciones/${organizationId}/inicio`);
  revalidatePath(`/organizaciones/${organizationId}/sedes`);
  revalidatePath(`/organizaciones/${organizationId}/equipos`);

  if (competitionId && seasonId) {
    const base = `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}`;
    revalidatePath(base);
    revalidatePath(`${base}/equipos`);
    revalidatePath(`${base}/calendario`);
    revalidatePath(`${base}/canchas`);
    revalidatePath(`${base}/fixture/generar`);
    for (const step of ["equipos", "jugadores", "horarios", "generar"] as const) {
      revalidatePath(
        `/organizaciones/${organizationId}/torneos/asistente/${competitionId}/${seasonId}/${step}`
      );
    }
  }
}

export async function startTournamentWizardAction(
  _prev: TournamentWizardActionState,
  formData: FormData
): Promise<TournamentWizardActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  await requireOrganizationAdmin(user.id, organizationId);

  const tournamentName = String(formData.get("tournamentName") ?? "");
  const approximateTeamsRaw = String(formData.get("approximateTeams") ?? "4");
  const fieldCountRaw = String(formData.get("fieldCount") ?? "2");

  const values = {
    tournamentName,
    approximateTeams: approximateTeamsRaw,
    fieldCount: fieldCountRaw,
  };

  const fieldErrors: Record<string, string> = {};
  const nameError = validateName(tournamentName, "nombre del torneo");
  if (nameError) fieldErrors.tournamentName = nameError;

  const approximateTeams = Number.parseInt(approximateTeamsRaw, 10);
  if (!Number.isInteger(approximateTeams) || approximateTeams < 2) {
    fieldErrors.approximateTeams = "Indica al menos 2 equipos.";
  }

  const requestedFieldCount = Number.parseInt(fieldCountRaw, 10);
  if (!Number.isInteger(requestedFieldCount) || requestedFieldCount < 1) {
    fieldErrors.fieldCount = "Indica al menos 1 cancha.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      message: "Revisa los datos del torneo.",
      fieldErrors,
      values,
    };
  }

  const tierCheck = await assertCanCreateCompetition(organizationId);
  if (!tierCheck.ok) {
    return { ok: false, message: tierCheck.message, values };
  }

  const supabase = await createClient();

  const { data: competition, error: competitionError } = await supabase
    .from("competitions")
    .insert({
      organization_id: organizationId,
      name: tournamentName.trim(),
      is_youth: false,
    })
    .select("id")
    .single();

  if (competitionError || !competition) {
    return {
      ok: false,
      message: "No pudimos crear el torneo. Inténtalo nuevamente.",
      values,
    };
  }

  const seasonName = tournamentName.trim();
  const { data: seasonId, error: seasonError } = await supabase.rpc(
    "create_season_with_rules",
    {
      p_competition_id: competition.id,
      p_name: seasonName,
      p_slug: slugifySeasonName(seasonName),
      p_format_type: "round_robin",
      p_visibility: "draft",
      p_starts_on: null as unknown as string,
      p_ends_on: null as unknown as string,
      p_points_win: 3,
      p_points_draw: 1,
      p_points_loss: 0,
      p_allow_draws: true,
      p_match_duration_minutes: 90,
      p_minimum_rest_minutes: 0,
      p_yellow_card_limit: 5,
      p_suspension_matches: 1,
    }
  );

  if (seasonError || !seasonId) {
    return {
      ok: false,
      message: "No pudimos crear la temporada. Inténtalo nuevamente.",
      values,
    };
  }

  let venueId: string | null = null;
  const venueCheck = await assertCanCreateVenue(organizationId);
  if (venueCheck.ok) {
    const { data: venue, error: venueError } = await supabase
      .from("venues")
      .insert({
        organization_id: organizationId,
        name: "Mi sede",
        is_active: true,
      })
      .select("id")
      .single();

    if (venueError || !venue) {
      return {
        ok: false,
        message: "No pudimos crear la sede. Inténtalo nuevamente.",
        values,
      };
    }
    venueId = venue.id;
  } else {
    const { data: existingVenue } = await supabase
      .from("venues")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!existingVenue) {
      return { ok: false, message: venueCheck.message, values };
    }
    venueId = existingVenue.id;
  }

  let createdFields = 0;
  for (let index = 0; index < requestedFieldCount; index += 1) {
    const fieldTierCheck = await assertCanCreateField(organizationId);
    if (!fieldTierCheck.ok) {
      if (createdFields === 0) {
        return { ok: false, message: fieldTierCheck.message, values };
      }
      break;
    }

    const { error: fieldError } = await supabase.from("fields").insert({
      venue_id: venueId,
      organization_id: organizationId,
      name: `Cancha ${index + 1}`,
      is_active: true,
    });

    if (fieldError) {
      if (createdFields === 0) {
        return {
          ok: false,
          message: "No pudimos crear las canchas. Inténtalo nuevamente.",
          values,
        };
      }
      break;
    }

    createdFields += 1;
  }

  await revalidateWizardPaths(organizationId, competition.id, seasonId);
  redirect(
    `${wizardStepHref(organizationId, "equipos", competition.id, seasonId)}?equipos=${approximateTeams}`
  );
}

export async function wizardAddTeamsAction(
  _prev: TournamentWizardActionState,
  formData: FormData
): Promise<TournamentWizardActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const bulkList = String(formData.get("bulkList") ?? "");

  await requireOrganizationAdmin(user.id, organizationId);

  const names = parseBulkTeamNames(bulkList);
  if (names.length < 2) {
    return {
      ok: false,
      message: "Pega al menos 2 equipos (uno por línea).",
      values: { bulkList },
    };
  }

  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as {
    rpc: (
      fn: string,
      args?: Record<string, unknown>
    ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  }).rpc("create_teams_bulk", {
    p_organization_id: organizationId,
    p_names: names,
  });

  if (error) {
    return { ok: false, message: error.message, values: { bulkList } };
  }

  const result = data as { team_ids?: string[] | string } | null;
  const rawTeamIds = result?.team_ids;
  const teamIds = Array.isArray(rawTeamIds)
    ? rawTeamIds
    : typeof rawTeamIds === "string"
      ? (JSON.parse(rawTeamIds) as string[])
      : [];

  for (const teamId of teamIds) {
    const { error: enrollError } = await supabase.rpc("enroll_team_in_season", {
      p_season_id: seasonId,
      p_team_id: teamId,
      p_display_name: undefined,
      p_group_name: undefined,
      p_registration_status: "registered",
    });

    if (enrollError) {
      return { ok: false, message: enrollError.message, values: { bulkList } };
    }
  }

  await revalidateWizardPaths(organizationId, competitionId, seasonId);
  redirect(
    wizardStepHref(organizationId, "jugadores", competitionId, seasonId)
  );
}

export async function wizardAddPlayersAction(
  _prev: TournamentWizardActionState,
  formData: FormData
): Promise<TournamentWizardActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const entriesRaw = String(formData.get("playerEntries") ?? "[]");

  await requireOrganizationAdmin(user.id, organizationId);

  let entries: WizardPlayerEntry[];
  try {
    entries = JSON.parse(entriesRaw) as WizardPlayerEntry[];
  } catch {
    return { ok: false, message: "Datos de jugadores inválidos." };
  }

  const supabase = await createClient();

  for (const entry of entries) {
    const bulkList = entry.bulkList.trim();
    if (!bulkList) continue;

    const preview = parseBulkPlayerLines(bulkList);
    if (preview.length === 0) continue;
    if (hasDuplicateJerseyNumbers(preview)) {
      return {
        ok: false,
        message:
          "Hay dorsales duplicados en uno de los equipos. Corrígelos antes de continuar.",
      };
    }

    const rpcEntries = bulkPlayerEntriesForRpc(bulkList);
    const { error } = await (supabase as unknown as {
      rpc: (
        fn: string,
        args?: Record<string, unknown>
      ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
    }).rpc("create_players_and_add_to_roster_bulk", {
      p_season_team_id: entry.seasonTeamId,
      p_entries: rpcEntries,
    });

    if (error) {
      return { ok: false, message: error.message };
    }
  }

  await revalidateWizardPaths(organizationId, competitionId, seasonId);
  redirect(
    wizardStepHref(organizationId, "horarios", competitionId, seasonId)
  );
}

export async function wizardSkipPlayersAction(
  organizationId: string,
  competitionId: string,
  seasonId: string
): Promise<void> {
  const user = await requireUser();
  await requireOrganizationAdmin(user.id, organizationId);
  redirect(
    wizardStepHref(organizationId, "horarios", competitionId, seasonId)
  );
}

export async function wizardSetScheduleAction(
  _prev: TournamentWizardActionState,
  formData: FormData
): Promise<TournamentWizardActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const dayOfWeekRaw = String(formData.get("dayOfWeek") ?? "");
  const startsAt = String(formData.get("startsAt") ?? "").trim();
  const endsAt = String(formData.get("endsAt") ?? "").trim();
  const fieldIdsRaw = String(formData.get("fieldIds") ?? "[]");

  await requireOrganizationAdmin(user.id, organizationId);

  const values = { dayOfWeek: dayOfWeekRaw, startsAt, endsAt };
  const fieldErrors: Record<string, string> = {};
  const dayOfWeek = Number.parseInt(dayOfWeekRaw, 10);

  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    fieldErrors.dayOfWeek = "Selecciona un día válido.";
  }

  const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!timeRe.test(startsAt)) {
    fieldErrors.startsAt = "Indica una hora de inicio válida (HH:MM).";
  }
  if (!timeRe.test(endsAt)) {
    fieldErrors.endsAt = "Indica una hora de fin válida (HH:MM).";
  }
  if (
    timeRe.test(startsAt) &&
    timeRe.test(endsAt) &&
    endsAt <= startsAt
  ) {
    fieldErrors.endsAt = "La hora de fin debe ser posterior al inicio.";
  }

  let fieldIds: string[] = [];
  try {
    fieldIds = JSON.parse(fieldIdsRaw) as string[];
  } catch {
    fieldErrors.fieldIds = "No encontramos las canchas del torneo.";
  }

  if (fieldIds.length === 0) {
    fieldErrors.fieldIds = "No hay canchas configuradas para este torneo.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      message: "Revisa el horario de juego.",
      fieldErrors,
      values,
    };
  }

  const supabase = await createClient();
  const { data: fields } = await supabase
    .from("fields")
    .select("id, venue_id")
    .eq("organization_id", organizationId)
    .in("id", fieldIds);

  if (!fields || fields.length === 0) {
    return {
      ok: false,
      message: "No encontramos las canchas del torneo.",
      values,
    };
  }

  const schedule = buildWizardScheduleForFields(
    fields.map((field) => field.id),
    dayOfWeek,
    startsAt,
    endsAt
  );

  for (const fieldSchedule of schedule.availabilityByField) {
    const field = fields.find((item) => item.id === fieldSchedule.fieldId);
    if (!field) continue;

    const { error } = await supabase.rpc("replace_field_availability", {
      p_field_id: fieldSchedule.fieldId,
      p_intervals: fieldSchedule.intervals,
    });

    if (error) {
      return { ok: false, message: error.message, values };
    }
  }

  const { error: blocksError } = await supabase.rpc("set_season_field_blocks", {
    p_season_id: seasonId,
    p_blocks: schedule.seasonBlocks,
  });

  if (blocksError) {
    return { ok: false, message: blocksError.message, values };
  }

  await revalidateWizardPaths(organizationId, competitionId, seasonId);
  redirect(
    wizardStepHref(organizationId, "generar", competitionId, seasonId)
  );
}

export async function wizardGenerateFixtureAction(
  _prev: TournamentWizardActionState,
  formData: FormData
): Promise<TournamentWizardActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");

  await requireOrganizationAdmin(user.id, organizationId);

  const ctx = await getSeasonFixtureContext(
    organizationId,
    competitionId,
    seasonId
  );

  if (!ctx) {
    return { ok: false, message: "Temporada no encontrada." };
  }

  if (!ctx.canGenerate) {
    return {
      ok: false,
      message: ctx.existingMatchCount
        ? "Esta temporada ya tiene fixture."
        : "Necesitas al menos 2 equipos inscritos para generar el fixture.",
    };
  }

  let payload: ReturnType<typeof fixtureToJsonPayload>;
  try {
    const fixture = generateRoundRobinFixture(
      ctx.eligibleTeams.map((team) => ({
        seasonTeamId: team.seasonTeamId,
        name: team.name,
      })),
      "single"
    );
    payload = fixtureToJsonPayload(fixture.matches);
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "No se pudo calcular el fixture.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_season_round_robin_fixture", {
    p_season_id: seasonId,
    p_mode: "single",
    p_matches: payload as unknown as Json,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  await revalidateWizardPaths(organizationId, competitionId, seasonId);
  redirect(
    `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}/calendario`
  );
}

export async function getWizardDefaultFieldCount(
  organizationId: string
): Promise<number> {
  const status = await getOrganizationTierLimitStatus(organizationId);
  if (!status) return 2;
  return defaultWizardFieldCount(
    status.limits.canchas_total,
    status.usage.canchas_total
  );
}
