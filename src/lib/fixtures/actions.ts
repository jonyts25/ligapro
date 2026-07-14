"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import {
  fixtureToJsonPayload,
  generateRoundRobinFixture,
  type FixtureMode,
} from "@/lib/fixtures/round-robin";
import {
  initialFixtureActionState,
  type FixtureActionState,
} from "@/lib/fixtures/types";
import { getSeasonFixtureContext } from "@/lib/fixtures/queries";
import type { Json } from "@/types/database";
import { localMexicoCityToTimestamptz } from "@/lib/fixtures/timezone";

async function revalidateFixturePaths(
  organizationId: string,
  competitionId: string,
  seasonId: string,
  matchId?: string
) {
  const base = `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}`;
  revalidatePath(base);
  revalidatePath(`${base}/calendario`);
  revalidatePath(`${base}/posiciones`);
  revalidatePath(`${base}/goleadores`);
  revalidatePath(`${base}/disciplina`);
  revalidatePath(`${base}/fixture/generar`);
  revalidatePath(`/organizaciones/${organizationId}/inicio`);
  revalidatePath(`/organizaciones/${organizationId}/calendario`);
  revalidatePath(`/organizaciones/${organizationId}/partidos`);
  if (matchId) {
    revalidatePath(`${base}/partidos/${matchId}`);
    revalidatePath(`${base}/partidos/${matchId}/programar`);
  }

  const supabase = await createClient();
  const { data: season } = await supabase
    .from("seasons")
    .select("slug")
    .eq("id", seasonId)
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

function humanizeScheduleError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("overlap") ||
    lower.includes("no_overlapping") ||
    lower.includes("conflicting") ||
    lower.includes("exclusion")
  ) {
    return "La cancha ya está ocupada en ese horario. Elige otra hora o una cancha diferente.";
  }
  if (lower.includes("no availability") || lower.includes("no availability rules")) {
    return "Configura primero la disponibilidad habitual de esta cancha.";
  }
  if (lower.includes("outside field availability")) {
    return "El horario está fuera de la disponibilidad habitual de la cancha.";
  }
  if (lower.includes("field is inactive")) {
    return "Esta cancha está inactiva y no acepta nuevas programaciones.";
  }
  if (lower.includes("venue is inactive")) {
    return "La sede de esta cancha está inactiva.";
  }
  if (lower.includes("already has matches")) {
    return "Esta temporada ya tiene fixture. En F6 no se puede regenerar.";
  }
  return message || "No se pudo completar la operación.";
}

export async function createSeasonFixtureAction(
  _prev: FixtureActionState,
  formData: FormData
): Promise<FixtureActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const modeRaw = String(formData.get("mode") ?? "single");
  const confirmed = String(formData.get("confirmed") ?? "") === "1";

  await requireOrganizationAdmin(user.id, organizationId);

  if (!confirmed) {
    return {
      ...initialFixtureActionState,
      message: "Confirma explícitamente antes de guardar el fixture.",
      values: { mode: modeRaw },
    };
  }

  const mode: FixtureMode = modeRaw === "double" ? "double" : "single";
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
        : "No se puede generar el fixture con los equipos actuales.",
    };
  }

  let payload: ReturnType<typeof fixtureToJsonPayload>;
  try {
    const fixture = generateRoundRobinFixture(
      ctx.eligibleTeams.map((t) => ({
        seasonTeamId: t.seasonTeamId,
        name: t.name,
      })),
      mode
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
    p_mode: mode,
    p_matches: payload as unknown as Json,
  });

  if (error) {
    return { ok: false, message: humanizeScheduleError(error.message) };
  }

  await revalidateFixturePaths(organizationId, competitionId, seasonId);
  redirect(
    `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}/calendario`
  );
}

export async function scheduleMatchAction(
  _prev: FixtureActionState,
  formData: FormData
): Promise<FixtureActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const matchId = String(formData.get("matchId") ?? "");
  const fieldId = String(formData.get("fieldId") ?? "");
  const date = String(formData.get("date") ?? "").trim();
  const time = String(formData.get("time") ?? "").trim();

  await requireOrganizationAdmin(user.id, organizationId);

  const values = {
    fieldId,
    date,
    time,
    venueId: String(formData.get("venueId") ?? ""),
  };

  if (!fieldId || !date || !time) {
    return {
      ok: false,
      message: "Fecha, hora y cancha son obligatorias.",
      values,
    };
  }

  // Interpret local Mexico City wall time as timestamptz via offset offset fixed for CST/CDT:
  // Use ISO with explicit offset would be better; construct via Temporal-like approach:
  // Append Z offset by formatting with a known conversion: store as `date` + `T` + `time` + offset.
  // For America/Mexico_City, use Intl to get offset at that local wall clock.
  const startsAt = localMexicoCityToTimestamptz(date, time);
  if (!startsAt) {
    return {
      ok: false,
      message: "Fecha u hora inválidas.",
      values,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("schedule_match", {
    p_match_id: matchId,
    p_field_id: fieldId,
    p_starts_at: startsAt,
  });

  if (error) {
    return {
      ok: false,
      message: humanizeScheduleError(error.message),
      values,
    };
  }

  await revalidateFixturePaths(organizationId, competitionId, seasonId, matchId);
  redirect(
    `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}/partidos/${matchId}`
  );
}

export async function unscheduleMatchAction(
  _prev: FixtureActionState,
  formData: FormData
): Promise<FixtureActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const matchId = String(formData.get("matchId") ?? "");

  await requireOrganizationAdmin(user.id, organizationId);

  const supabase = await createClient();
  const { error } = await supabase.rpc("unschedule_match", {
    p_match_id: matchId,
  });

  if (error) {
    return { ok: false, message: humanizeScheduleError(error.message) };
  }

  await revalidateFixturePaths(organizationId, competitionId, seasonId, matchId);
  return {
    ok: true,
    message: "El partido quedó pendiente de programación.",
  };
}
