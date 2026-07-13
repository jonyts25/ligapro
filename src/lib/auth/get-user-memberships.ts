import { createClient } from "@/lib/supabase/server";
import type {
  OrganizationRole,
  UserOrganizationMembership,
} from "@/lib/auth/types";

export async function getUserMemberships(
  profileId: string
): Promise<UserOrganizationMembership[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, role, organizations(id, name)")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data
    .map((row) => {
      const orgRelation = row.organizations as
        | { id: string; name: string }
        | { id: string; name: string }[]
        | null;
      const org = Array.isArray(orgRelation) ? orgRelation[0] : orgRelation;
      if (!org?.name) return null;
      return {
        organizationId: row.organization_id,
        organizationName: org.name,
        role: row.role as OrganizationRole,
      } satisfies UserOrganizationMembership;
    })
    .filter((row): row is UserOrganizationMembership => row !== null);
}
