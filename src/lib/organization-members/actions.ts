"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import { isValidEmail, normalizeEmail } from "@/lib/auth/validation";
import { getPublicSiteUrl } from "@/lib/site-url";
import { canManageOrganizationMemberScopes } from "@/lib/organization-members/queries";
import type { OrganizationMembersActionState } from "@/lib/organization-members/types";

export const initialOrganizationMembersActionState: OrganizationMembersActionState =
  {
    ok: false,
    message: null,
  };

function membersPagePath(organizationId: string): string {
  return `/organizaciones/${organizationId}/miembros`;
}

async function assertCanManageScopes(
  organizationId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireUser();
  if (!(await canManageOrganizationMemberScopes(user.id, organizationId))) {
    return { ok: false, message: "No autorizado para gestionar scopes." };
  }
  return { ok: true };
}

export async function assignOrganizationMemberSeasonScopeAction(
  _prev: OrganizationMembersActionState,
  formData: FormData
): Promise<OrganizationMembersActionState> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const organizationMemberId = String(formData.get("organizationMemberId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");

  if (!organizationId || !organizationMemberId || !seasonId) {
    return { ok: false, message: "Datos incompletos." };
  }

  const auth = await assertCanManageScopes(organizationId);
  if (!auth.ok) {
    return auth;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("organization_member_scopes").insert({
    organization_id: organizationId,
    organization_member_id: organizationMemberId,
    scope_type: "season",
    scope_id: seasonId,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "Esa temporada ya está asignada." };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath(membersPagePath(organizationId));
  return { ok: true, message: "Temporada asignada al administrador." };
}

export async function removeOrganizationMemberSeasonScopeAction(
  _prev: OrganizationMembersActionState,
  formData: FormData
): Promise<OrganizationMembersActionState> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const scopeId = String(formData.get("scopeId") ?? "");

  if (!organizationId || !scopeId) {
    return { ok: false, message: "Datos incompletos." };
  }

  const auth = await assertCanManageScopes(organizationId);
  if (!auth.ok) {
    return auth;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("organization_member_scopes")
    .delete()
    .eq("id", scopeId)
    .eq("organization_id", organizationId)
    .eq("scope_type", "season");

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath(membersPagePath(organizationId));
  return { ok: true, message: "Scope de temporada eliminado." };
}

export async function inviteOrganizationMemberAction(
  _prev: OrganizationMembersActionState,
  formData: FormData
): Promise<OrganizationMembersActionState> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const email = normalizeEmail(formData.get("email"));
  const role = String(formData.get("role") ?? "organization_member");

  if (!organizationId) {
    return { ok: false, message: "Organización no válida." };
  }
  if (!isValidEmail(email)) {
    return { ok: false, message: "Correo inválido." };
  }
  if (role !== "organization_admin" && role !== "organization_member") {
    return { ok: false, message: "Rol inválido." };
  }

  const user = await requireUser();
  await requireOrganizationAdmin(user.id, organizationId);

  const supabase = await createClient();
  const { data: token, error } = await supabase.rpc(
    "invite_organization_member",
    {
      p_organization_id: organizationId,
      p_email: email,
      p_role: role,
    }
  );

  if (error || !token) {
    return {
      ok: false,
      message: error?.message ?? "No pudimos crear la invitación.",
    };
  }

  const inviteUrl = `${getPublicSiteUrl()}/invitacion/org/${token}`;
  revalidatePath(membersPagePath(organizationId));
  return {
    ok: true,
    message: "Invitación creada. Comparte el enlace con la persona invitada.",
    inviteUrl,
  };
}

export async function acceptOrganizationInvitationAction(
  _prev: OrganizationMembersActionState,
  formData: FormData
): Promise<OrganizationMembersActionState> {
  await requireUser();
  const token = String(formData.get("token") ?? "");
  if (!token) {
    return { ok: false, message: "Token inválido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_organization_invitation", {
    p_token: token,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true, message: "Invitación aceptada." };
}
