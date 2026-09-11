"use server";

import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import {
  getSeasonMaxRosterSize,
  getTeamRosterImportSources,
} from "@/lib/teams/queries";
import type { RosterImportSource } from "@/lib/teams/roster-import";

export type TeamRosterImportOptions = {
  sources: RosterImportSource[];
  maxRosterSize: number | null;
};

export async function loadTeamRosterImportOptionsAction(
  organizationId: string,
  seasonId: string,
  teamId: string
): Promise<TeamRosterImportOptions> {
  const user = await requireUser();
  await requireOrganizationAdmin(user.id, organizationId);

  const [sources, maxRosterSize] = await Promise.all([
    getTeamRosterImportSources(organizationId, teamId, seasonId),
    getSeasonMaxRosterSize(organizationId, seasonId),
  ]);

  return { sources, maxRosterSize };
}
