import { createClient } from "@/lib/supabase/server";

export type TeamRegistrationRequestRow = {
  id: string;
  season_id: string;
  organization_id: string;
  team_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  requested_group_name: string | null;
  status: string;
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export async function getPendingTeamRegistrationRequests(
  organizationId: string,
  seasonId: string
): Promise<TeamRegistrationRequestRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("season_team_registration_requests")
    .select(
      "id, season_id, organization_id, team_name, contact_name, contact_email, contact_phone, requested_group_name, status, rejection_reason, reviewed_at, created_at"
    )
    .eq("organization_id", organizationId)
    .eq("season_id", seasonId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  return (data ?? []) as TeamRegistrationRequestRow[];
}

export async function countPendingTeamRegistrationRequests(
  organizationId: string,
  seasonId: string
): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("season_team_registration_requests")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("season_id", seasonId)
    .eq("status", "pending");

  return count ?? 0;
}
