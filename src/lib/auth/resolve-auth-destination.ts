import { getCaptainTeams } from "@/lib/auth/get-captain-teams";
import { getUserMemberships } from "@/lib/auth/get-user-memberships";

/**
 * Post-login routing.
 *
 * Org memberships take priority when present (admin who is also captain elsewhere).
 * Captains without org membership go to /mi-equipo instead of /onboarding.
 */
export async function resolveAuthDestination(profileId: string): Promise<string> {
  const memberships = await getUserMemberships(profileId);

  if (memberships.length > 0) {
    if (memberships.length === 1) {
      return `/organizaciones/${memberships[0].organizationId}/inicio`;
    }
    return "/seleccionar-organizacion";
  }

  const captainTeams = await getCaptainTeams(profileId);
  if (captainTeams.length === 1) {
    return `/mi-equipo/${captainTeams[0].seasonTeamId}`;
  }
  if (captainTeams.length > 1) {
    return "/mi-equipo";
  }

  return "/onboarding";
}

export async function resolveCaptainPortalDestination(
  profileId: string
): Promise<string> {
  const captainTeams = await getCaptainTeams(profileId);
  if (captainTeams.length === 1) {
    return `/mi-equipo/${captainTeams[0].seasonTeamId}`;
  }
  return "/mi-equipo";
}
