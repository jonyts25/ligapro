import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  OrganizationRole,
  UserOrganizationMembership,
} from "@/lib/auth/types";

export async function requireOrganizationMembership(
  profileId: string,
  organizationId: string
): Promise<UserOrganizationMembership> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, role, organizations(id, name)")
    .eq("profile_id", profileId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  const orgRelation = data.organizations as
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null;
  const org = Array.isArray(orgRelation) ? orgRelation[0] : orgRelation;

  if (!org?.name) {
    notFound();
  }

  return {
    organizationId: data.organization_id,
    organizationName: org.name,
    role: data.role as OrganizationRole,
  };
}
