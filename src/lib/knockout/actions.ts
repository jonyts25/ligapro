"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import type { KnockoutActionState } from "@/lib/knockout/types";

async function revalidateKnockoutPaths(
  organizationId: string,
  competitionId: string,
  seasonId: string
) {
  const base = `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}`;
  revalidatePath(base);
  revalidatePath(`${base}/bracket`);
  revalidatePath(`${base}/grupos`);
  revalidatePath(`${base}/calendario`);
  revalidatePath(`${base}/posiciones`);
  revalidatePath(`/organizaciones/${organizationId}/inicio`);

  const supabase = await createClient();
  const { data: season } = await supabase
    .from("seasons")
    .select("slug")
    .eq("id", seasonId)
    .maybeSingle();
  if (season?.slug) {
    const publicBase = `/publico/${organizationId}/${season.slug}`;
    revalidatePath(publicBase);
    revalidatePath(`${publicBase}/posiciones`);
    revalidatePath(`${publicBase}/calendario`);
  }
}

function humanizeKnockoutError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("facturaci")) {
    return message;
  }
  if (lower.includes("already has")) {
    return "Esta temporada ya tiene un bracket o partidos que lo impiden.";
  }
  if (lower.includes("not authorized")) {
    return "No tienes permiso para esta acción.";
  }
  if (lower.includes("empat") || lower.includes("tied")) {
    return "Solo puedes registrar penales cuando la llave está empatada.";
  }
  if (lower.includes("resolved") || lower.includes("sin resultado")) {
    return message;
  }
  return message || "No se pudo completar la operación.";
}

export async function createKnockoutBracketAction(
  _prev: KnockoutActionState,
  formData: FormData
): Promise<KnockoutActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  await requireOrganizationAdmin(user.id, organizationId);

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_season_knockout_bracket", {
    p_season_id: seasonId,
    p_seed_mode: "random",
  });

  if (error) {
    return { ok: false, message: humanizeKnockoutError(error.message) };
  }

  await revalidateKnockoutPaths(organizationId, competitionId, seasonId);
  return { ok: true, message: "Bracket generado correctamente." };
}

export async function configureKnockoutRoundAction(
  _prev: KnockoutActionState,
  formData: FormData
): Promise<KnockoutActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const roundId = String(formData.get("roundId") ?? "");
  const isTwoLegs = String(formData.get("isTwoLegs") ?? "") === "1";
  await requireOrganizationAdmin(user.id, organizationId);

  const supabase = await createClient();
  const { error } = await supabase.rpc("configure_knockout_round", {
    p_round_id: roundId,
    p_is_two_legs: isTwoLegs,
  });

  if (error) {
    return { ok: false, message: humanizeKnockoutError(error.message) };
  }

  await revalidateKnockoutPaths(organizationId, competitionId, seasonId);
  return {
    ok: true,
    message: isTwoLegs
      ? "Ronda configurada a ida y vuelta."
      : "Ronda configurada a partido único.",
  };
}

export async function setKnockoutPenaltyWinnerAction(
  _prev: KnockoutActionState,
  formData: FormData
): Promise<KnockoutActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const roundId = String(formData.get("roundId") ?? "");
  const bracketSlot = Number(formData.get("bracketSlot") ?? 0);
  const winnerSeasonTeamId = String(formData.get("winnerSeasonTeamId") ?? "");
  await requireOrganizationAdmin(user.id, organizationId);

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_knockout_tie_penalty_winner", {
    p_round_id: roundId,
    p_bracket_slot: bracketSlot,
    p_winner_season_team_id: winnerSeasonTeamId,
  });

  if (error) {
    return { ok: false, message: humanizeKnockoutError(error.message) };
  }

  await revalidateKnockoutPaths(organizationId, competitionId, seasonId);
  return { ok: true, message: "Ganador por penales registrado." };
}

export async function advanceKnockoutRoundAction(
  _prev: KnockoutActionState,
  formData: FormData
): Promise<KnockoutActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const roundNumber = Number(formData.get("roundNumber") ?? 0);
  await requireOrganizationAdmin(user.id, organizationId);

  const supabase = await createClient();
  const { error } = await supabase.rpc("advance_knockout_round", {
    p_season_id: seasonId,
    p_round_number: roundNumber,
  });

  if (error) {
    return { ok: false, message: humanizeKnockoutError(error.message) };
  }

  await revalidateKnockoutPaths(organizationId, competitionId, seasonId);
  return { ok: true, message: "Siguiente ronda generada." };
}

export async function generateKnockoutFromGroupsAction(
  _prev: KnockoutActionState,
  formData: FormData
): Promise<KnockoutActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  await requireOrganizationAdmin(user.id, organizationId);

  const supabase = await createClient();
  const { error } = await supabase.rpc("generate_knockout_from_groups", {
    p_season_id: seasonId,
  });

  if (error) {
    return { ok: false, message: humanizeKnockoutError(error.message) };
  }

  await revalidateKnockoutPaths(organizationId, competitionId, seasonId);
  return { ok: true, message: "Eliminatoria generada desde los grupos." };
}
