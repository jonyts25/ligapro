export type MatchResultReviewPhase =
  | "not_applicable"
  | "pending"
  | "disputed"
  | "approved";

export type MatchResultReviewStatus = {
  phase: MatchResultReviewPhase;
  reviewOpenedAt: string | null;
  autoCloseAt: string | null;
  approvedAt: string | null;
  approvedByProfileId: string | null;
  openDispute: {
    id: string;
    reason: string;
    openedByProfileId: string;
    openedByDisplayName: string;
    seasonTeamId: string;
    createdAt: string;
  } | null;
  canOpenDispute: boolean;
  canApproveResult: boolean;
};
