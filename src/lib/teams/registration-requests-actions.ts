"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import type { TeamsActionState } from "@/lib/teams/types";

function revalidateRegistrationPaths(
  organizationId: string,
  competitionId: string,
  seasonId: string
) {
  revalidatePath(
    `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}/inscripciones-equipo`
  );
  revalidatePath(
    `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}/equipos`
  );
  revalidatePath(`/organizaciones/${organizationId}/inicio`);
}

export async function approveTeamRegistrationRequestAction(
  _prev: TeamsActionState,
  formData: FormData
): Promise<TeamsActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const requestId = String(formData.get("requestId") ?? "");

  await requireOrganizationAdmin(user.id, organizationId);

  if (!requestId) {
    return { ok: false, message: "Solicitud no válida." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_team_registration_request", {
    p_request_id: requestId,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateRegistrationPaths(organizationId, competitionId, seasonId);
  return {
    ok: true,
    message: "Equipo aprobado e inscrito. Invitación enviada al capitán.",
  };
}

export async function rejectTeamRegistrationRequestAction(
  _prev: TeamsActionState,
  formData: FormData
): Promise<TeamsActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const requestId = String(formData.get("requestId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  await requireOrganizationAdmin(user.id, organizationId);

  if (!requestId) {
    return { ok: false, message: "Solicitud no válida." };
  }

  if (!reason) {
    return {
      ok: false,
      message: "Indica el motivo del rechazo.",
      fieldErrors: { reason: "El motivo es obligatorio." },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_team_registration_request", {
    p_request_id: requestId,
    p_reason: reason,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateRegistrationPaths(organizationId, competitionId, seasonId);
  return { ok: true, message: "Solicitud rechazada." };
}

export async function submitPublicTeamRegistrationAction(
  _prev: TeamsActionState,
  formData: FormData
): Promise<TeamsActionState> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const seasonSlug = String(formData.get("seasonSlug") ?? "");
  const teamName = String(formData.get("teamName") ?? "").trim();
  const contactName = String(formData.get("contactName") ?? "").trim();
  const contactEmail = String(formData.get("contactEmail") ?? "").trim();
  const contactPhone = String(formData.get("contactPhone") ?? "").trim();
  const requestedGroupName = String(
    formData.get("requestedGroupName") ?? ""
  ).trim();

  const values = {
    teamName,
    contactName,
    contactEmail,
    contactPhone,
    requestedGroupName,
  };
  const fieldErrors: Record<string, string> = {};

  if (teamName.length < 2) {
    fieldErrors.teamName = "Indica el nombre del equipo.";
  }
  if (contactName.length < 2) {
    fieldErrors.contactName = "Indica tu nombre.";
  }
  if (!contactEmail.includes("@")) {
    fieldErrors.contactEmail = "Indica un correo válido.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      message: "Revisa los datos del formulario.",
      fieldErrors,
      values,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_team_registration_request", {
    p_organization_id: organizationId,
    p_season_slug: seasonSlug,
    p_team_name: teamName,
    p_contact_name: contactName,
    p_contact_email: contactEmail,
    p_contact_phone: contactPhone || undefined,
    p_requested_group_name: requestedGroupName || undefined,
  });

  if (error || !data) {
    return {
      ok: false,
      message:
        error?.message ??
        "No pudimos enviar tu solicitud. El registro puede no estar disponible.",
      values,
    };
  }

  return {
    ok: true,
    message:
      "Tu solicitud fue enviada, el organizador la revisará.",
    values,
  };
}
