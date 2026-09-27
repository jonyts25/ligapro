import { createClient } from "@/lib/supabase/server";
import type { MatchResultReviewStatus } from "@/lib/matches/result-review-types";
import type { MatchStatusValue } from "@/lib/matches/types";
import { resolveUpdateResultPermissions } from "@/lib/matches/update-result-permissions";

function profileDisplayName(row: {
  display_name: string | null;
  email: string;
}): string {
  return row.display_name?.trim() || row.email;
}

export async function getMatchResultReviewStatus(
  organizationId: string,
  seasonId: string,
  matchId: string,
  matchStatus: MatchStatusValue,
  userId: string,
  orgRole: string
): Promise<MatchResultReviewStatus> {
  const closed = matchStatus === "finished" || matchStatus === "walkover";
  const empty: MatchResultReviewStatus = {
    phase: "not_applicable",
    reviewOpenedAt: null,
    autoCloseAt: null,
    approvedAt: null,
    approvedByProfileId: null,
    openDispute: null,
    canOpenDispute: false,
    canApproveResult: false,
  };

  if (!closed) return empty;

  const supabase = await createClient();
  const isOrgAdmin =
    orgRole === "organization_owner" || orgRole === "organization_admin";

  const [
    { data: matchRow },
    { data: openDispute },
    { data: seasonRoles },
    { data: isCaptain },
  ] = await Promise.all([
    supabase
      .from("matches")
      .select(
        "result_review_opened_at, result_review_auto_close_at, result_approved_at, result_approved_by_profile_id"
      )
      .eq("id", matchId)
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase
      .from("match_result_disputes")
      .select(
        "id, reason, opened_by_profile_id, season_team_id, created_at, profiles!match_result_disputes_opened_by_profile_id_fkey(display_name, email)"
      )
      .eq("match_id", matchId)
      .eq("organization_id", organizationId)
      .eq("status", "open")
      .maybeSingle(),
    supabase
      .from("season_roles")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("season_id", seasonId)
      .eq("profile_id", userId),
    supabase.rpc("is_active_captain_of_match", {
      p_match_id: matchId,
      p_profile_id: userId,
    }),
  ]);

  if (!matchRow) return empty;

  const roles = (seasonRoles ?? []).map((r) => r.role);
  const isTournamentAdmin = roles.includes("tournament_admin");
  const resultPermissions = resolveUpdateResultPermissions({
    isOrgAdmin,
    isTournamentAdmin,
    isConfirmedReferee: false,
    currentMatchStatus: matchStatus,
  });

  const approvedAt = matchRow.result_approved_at;
  const openDisputeRow = openDispute
    ? {
        id: openDispute.id,
        reason: openDispute.reason,
        openedByProfileId: openDispute.opened_by_profile_id,
        openedByDisplayName: (() => {
          const profileRel = openDispute.profiles as
            | { display_name: string | null; email: string }
            | { display_name: string | null; email: string }[]
            | null;
          const profile = Array.isArray(profileRel) ? profileRel[0] : profileRel;
          return profile
            ? profileDisplayName(profile)
            : "Capitán";
        })(),
        seasonTeamId: openDispute.season_team_id,
        createdAt: openDispute.created_at,
      }
    : null;

  let phase: MatchResultReviewStatus["phase"] = "not_applicable";
  if (approvedAt) {
    phase = "approved";
  } else if (openDisputeRow) {
    phase = "disputed";
  } else if (matchRow.result_review_opened_at) {
    phase = "pending";
  }

  const canApproveResult =
    resultPermissions.canUpdateResult && !approvedAt && phase !== "not_applicable";
  const canOpenDispute =
    Boolean(isCaptain) && !approvedAt && !openDisputeRow && phase === "pending";

  return {
    phase,
    reviewOpenedAt: matchRow.result_review_opened_at,
    autoCloseAt: matchRow.result_review_auto_close_at,
    approvedAt,
    approvedByProfileId: matchRow.result_approved_by_profile_id,
    openDispute: openDisputeRow,
    canOpenDispute,
    canApproveResult,
  };
}
