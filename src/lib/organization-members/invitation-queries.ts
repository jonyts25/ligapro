import { createClient } from "@/lib/supabase/server";
import type { OrganizationInvitationPreview } from "@/lib/organization-members/types";

export async function getOrganizationInvitationByToken(
  profileId: string | null,
  profileEmail: string | null,
  token: string
): Promise<{
  preview: OrganizationInvitationPreview | null;
  reason: "invalid" | "email_mismatch" | "ok" | "login_required";
}> {
  if (!profileId) {
    return { preview: null, reason: "login_required" };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("organization_invitations")
    .select(
      "id, email, role, status, expires_at, organizations(name)"
    )
    .eq("token", token)
    .maybeSingle();

  if (!data) {
    return { preview: null, reason: "invalid" };
  }

  if (
    profileEmail &&
    profileEmail.toLowerCase() !== data.email.toLowerCase()
  ) {
    return { preview: null, reason: "email_mismatch" };
  }

  const orgRel = data.organizations as
    | { name: string }
    | { name: string }[]
    | null;
  const org = Array.isArray(orgRel) ? orgRel[0] : orgRel;

  const isExpired =
    data.status === "expired" ||
    (data.status === "pending" &&
      new Date(data.expires_at).getTime() < Date.now());

  return {
    preview: {
      id: data.id,
      email: data.email,
      role: data.role,
      status: isExpired ? "expired" : data.status,
      expiresAt: data.expires_at,
      organizationName: org?.name ?? null,
      isExpired,
    },
    reason: "ok",
  };
}
