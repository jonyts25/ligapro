import type {
  MatchChronicleJobRow,
  MatchChronicleRow,
} from "@/lib/chronicles/types";

export function shouldShowChronicleElaborationMessage(input: {
  matchFinished: boolean;
  resultApproved: boolean;
  chronicle: MatchChronicleRow | null;
  job: MatchChronicleJobRow | null;
}): boolean {
  if (!input.matchFinished) return false;
  if (!input.resultApproved) return true;
  if (
    !input.chronicle &&
    (!input.job ||
      input.job.status === "pending" ||
      input.job.status === "processing")
  ) {
    return true;
  }
  return false;
}

export function shouldShowChronicleGenerateButton(input: {
  canManage: boolean;
  resultApproved: boolean;
  chronicle: MatchChronicleRow | null;
  job: MatchChronicleJobRow | null;
}): boolean {
  if (!input.canManage || !input.resultApproved) return false;

  return !shouldShowChronicleElaborationMessage({
    matchFinished: true,
    resultApproved: input.resultApproved,
    chronicle: input.chronicle,
    job: input.job,
  });
}
