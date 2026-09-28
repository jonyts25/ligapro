import { createClient } from "@/lib/supabase/server";

type UntypedRpc = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export async function isPublicTeamRegistrationOpen(
  organizationId: string,
  seasonSlug: string
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as UntypedRpc).rpc(
    "is_public_team_registration_open",
    {
      p_organization_id: organizationId,
      p_season_slug: seasonSlug,
    }
  );
  if (error) return false;
  return data === true;
}

export async function submitPublicTeamRegistrationRequest(input: {
  organizationId: string;
  seasonSlug: string;
  teamName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  requestedGroupName?: string | null;
}): Promise<{ ok: true; requestId: string } | { ok: false; message: string }> {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as UntypedRpc).rpc(
    "submit_team_registration_request",
    {
      p_organization_id: input.organizationId,
      p_season_slug: input.seasonSlug,
      p_team_name: input.teamName,
      p_contact_name: input.contactName,
      p_contact_email: input.contactEmail,
      p_contact_phone: input.contactPhone ?? null,
      p_requested_group_name: input.requestedGroupName ?? null,
    }
  );

  if (error || !data) {
    return {
      ok: false,
      message:
        error?.message ??
        "No pudimos enviar tu solicitud. Inténtalo nuevamente.",
    };
  }

  return { ok: true, requestId: String(data) };
}
