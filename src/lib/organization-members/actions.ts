"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
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
