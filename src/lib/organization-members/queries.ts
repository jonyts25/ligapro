import { createClient } from "@/lib/supabase/server";
import { isOrganizationAdminRole } from "@/lib/auth/is-organization-admin";
import type { OrganizationRole } from "@/lib/auth/types";
import type {
  OrganizationMemberListItem,
  OrganizationMemberSeasonScope,
  OrganizationSeasonScopeOption,
} from "@/lib/organization-members/types";

function profileLabel(row: {
  display_name: string | null;
  email: string;
}): { displayName: string; email: string } {
  return {
    displayName: row.display_name?.trim() || row.email,
    email: row.email,
  };
}

const ROLE_ORDER: Record<string, number> = {
  organization_owner: 0,
  organization_admin: 1,
  organization_member: 2,
};

export async function canManageOrganizationMemberScopes(
  profileId: string,
  organizationId: string
): Promise<boolean> {
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("organization_members")
    .select("id, role")
    .eq("organization_id", organizationId)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (!membership || !isOrganizationAdminRole(membership.role)) {
    return false;
  }

  if (membership.role === "organization_owner") {
    return true;
  }

  const { count, error } = await supabase
    .from("organization_member_scopes")
    .select("id", { count: "exact", head: true })
    .eq("organization_member_id", membership.id);

  if (error) {
    return false;
  }

  return (count ?? 0) === 0;
}

export async function getOrganizationSeasonScopeOptions(
  organizationId: string
): Promise<OrganizationSeasonScopeOption[]> {
  const supabase = await createClient();
  const { data: seasons } = await supabase
    .from("seasons")
    .select("id, name, competitions(name)")
    .eq("organization_id", organizationId)
    .neq("visibility", "archived")
    .order("created_at", { ascending: false });

  return (seasons ?? []).map((row) => {
    const competitionRel = row.competitions as
      | { name: string }
      | { name: string }[]
      | null;
    const competition = Array.isArray(competitionRel)
      ? competitionRel[0]
      : competitionRel;
    const competitionName = competition?.name ?? "Torneo";
    return {
      seasonId: row.id,
      label: `${competitionName} · ${row.name}`,
    };
  });
}

export async function getOrganizationMembersWithScopes(
  organizationId: string
): Promise<OrganizationMemberListItem[]> {
  const supabase = await createClient();

  const [{ data: members }, { data: scopes }, seasonOptions] = await Promise.all([
    supabase
      .from("organization_members")
      .select("id, profile_id, role, profiles(display_name, email)")
      .eq("organization_id", organizationId),
    supabase
      .from("organization_member_scopes")
      .select("id, organization_member_id, scope_type, scope_id")
      .eq("organization_id", organizationId)
      .eq("scope_type", "season"),
    getOrganizationSeasonScopeOptions(organizationId),
  ]);

  const seasonNameById = new Map(
    seasonOptions.map((option) => [option.seasonId, option.label])
  );

  const scopesByMember = new Map<string, OrganizationMemberSeasonScope[]>();
  for (const scope of scopes ?? []) {
    const list = scopesByMember.get(scope.organization_member_id) ?? [];
    list.push({
      id: scope.id,
      seasonId: scope.scope_id,
      seasonName:
        seasonNameById.get(scope.scope_id) ?? "Temporada desconocida",
    });
    scopesByMember.set(scope.organization_member_id, list);
  }

  const rows = (members ?? []).map((row) => {
    const profileRel = row.profiles as
      | { display_name: string | null; email: string }
      | { display_name: string | null; email: string }[]
      | null;
    const profile = Array.isArray(profileRel) ? profileRel[0] : profileRel;
    const label = profile
      ? profileLabel(profile)
      : { displayName: "Miembro", email: "" };

    return {
      memberId: row.id,
      profileId: row.profile_id,
      displayName: label.displayName,
      email: label.email,
      role: row.role as OrganizationRole,
      seasonScopes: scopesByMember.get(row.id) ?? [],
    } satisfies OrganizationMemberListItem;
  });

  return rows.sort((a, b) => {
    const roleDiff =
      (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99);
    if (roleDiff !== 0) return roleDiff;
    return a.displayName.localeCompare(b.displayName, "es");
  });
}
