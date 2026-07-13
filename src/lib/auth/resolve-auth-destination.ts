import { getUserMemberships } from "@/lib/auth/get-user-memberships";

export async function resolveAuthDestination(profileId: string): Promise<string> {
  const memberships = await getUserMemberships(profileId);

  if (memberships.length === 0) {
    return "/onboarding";
  }

  if (memberships.length === 1) {
    return `/organizaciones/${memberships[0].organizationId}/inicio`;
  }

  return "/seleccionar-organizacion";
}
