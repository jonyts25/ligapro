"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import {
  SUSPENSION_TYPE_OPTIONS,
  type AdministrativeSuspensionType,
  type DisciplineActionState,
} from "@/lib/discipline/types";
import { getSeasonSlug } from "@/lib/standings/queries";

async function revalidateDisciplinePaths(
  organizationId: string,
  competitionId: string,
  seasonId: string
) {
  const base = `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}`;
  revalidatePath(`${base}/disciplina`);
  revalidatePath(`${base}/dashboard`);

  const slug = await getSeasonSlug(organizationId, seasonId);
  if (slug) {
    revalidatePath(`/publico/${organizationId}/${slug}/disciplina`);
  }
}

function isAdminSuspensionType(
  value: string
): value is AdministrativeSuspensionType {
  return SUSPENSION_TYPE_OPTIONS.some((o) => o.value === value);
}

function parseReason(raw: string): { reason: string | null; error?: string } {
  const reason = raw.trim();
  if (!reason) {
    return { reason: null, error: "El motivo es obligatorio." };
  }
  return { reason };
}

export async function waiveDisciplineSuspensionAction(
  _prev: DisciplineActionState,
  formData: FormData
): Promise<DisciplineActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const suspensionId = String(formData.get("suspensionId") ?? "");
  await requireOrganizationAdmin(user.id, organizationId);

  const { reason, error: reasonError } = parseReason(
    String(formData.get("reason") ?? "")
  );
  if (reasonError || !reason) {
    return {
      ok: false,
      message: reasonError ?? "El motivo es obligatorio.",
      fieldErrors: { reason: "Indica el motivo." },
    };
  }
  if (!suspensionId) {
    return { ok: false, message: "Sanción no válida." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("waive_discipline_suspension", {
    p_suspension_id: suspensionId,
    p_reason: reason,
  });

  if (error) {
    return {
      ok: false,
      message: "No pudimos levantar la sanción. Inténtalo nuevamente.",
    };
  }

  await revalidateDisciplinePaths(organizationId, competitionId, seasonId);
  return { ok: true, message: "Sanción levantada." };
}

export async function adjustDisciplineSuspensionAction(
  _prev: DisciplineActionState,
  formData: FormData
): Promise<DisciplineActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const suspensionId = String(formData.get("suspensionId") ?? "");
  await requireOrganizationAdmin(user.id, organizationId);

  const matchesRaw = String(formData.get("matchesRemaining") ?? "").trim();
  const { reason, error: reasonError } = parseReason(
    String(formData.get("reason") ?? "")
  );

  const fieldErrors: Record<string, string> = {};
  if (reasonError || !reason) {
    fieldErrors.reason = "Indica el motivo.";
  }
  if (
    !matchesRaw ||
    Number.isNaN(Number(matchesRaw)) ||
    Number(matchesRaw) < 0
  ) {
    fieldErrors.matchesRemaining = "Indica partidos restantes (≥ 0).";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      message: "Revisa los datos del ajuste.",
      fieldErrors,
    };
  }
  if (!suspensionId) {
    return { ok: false, message: "Sanción no válida." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("adjust_discipline_suspension_length", {
    p_suspension_id: suspensionId,
    p_matches_remaining: Number(matchesRaw),
    p_reason: reason!,
  });

  if (error) {
    return {
      ok: false,
      message: "No pudimos ajustar la sanción. Inténtalo nuevamente.",
    };
  }

  await revalidateDisciplinePaths(organizationId, competitionId, seasonId);
  return { ok: true, message: "Partidos restantes actualizados." };
}

export async function createAdministrativeSuspensionAction(
  _prev: DisciplineActionState,
  formData: FormData
): Promise<DisciplineActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  await requireOrganizationAdmin(user.id, organizationId);

  const seasonTeamPlayerId = String(formData.get("seasonTeamPlayerId") ?? "");
  const suspensionType = String(formData.get("suspensionType") ?? "");
  const matchesRaw = String(formData.get("matchesRemaining") ?? "").trim();
  const { reason, error: reasonError } = parseReason(
    String(formData.get("reason") ?? "")
  );

  const fieldErrors: Record<string, string> = {};
  if (!seasonTeamPlayerId) {
    fieldErrors.seasonTeamPlayerId = "Selecciona un jugador.";
  }
  if (!isAdminSuspensionType(suspensionType)) {
    fieldErrors.suspensionType = "Selecciona un tipo válido.";
  }
  if (
    !matchesRaw ||
    Number.isNaN(Number(matchesRaw)) ||
    Number(matchesRaw) < 0
  ) {
    fieldErrors.matchesRemaining = "Indica partidos (≥ 0).";
  }
  if (reasonError || !reason) {
    fieldErrors.reason = "Indica el motivo.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      message: "Revisa los datos de la sanción.",
      fieldErrors,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_administrative_suspension", {
    p_season_team_player_id: seasonTeamPlayerId,
    p_suspension_type: suspensionType,
    p_matches_remaining: Number(matchesRaw),
    p_reason: reason!,
  });

  if (error) {
    return {
      ok: false,
      message: "No pudimos crear la sanción. Inténtalo nuevamente.",
    };
  }

  await revalidateDisciplinePaths(organizationId, competitionId, seasonId);
  return { ok: true, message: "Sanción administrativa registrada." };
}
