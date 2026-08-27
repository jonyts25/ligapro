"use client";

import type { MatchCapturePermissions, MatchStatusValue } from "@/lib/matches/types";
import { useDemoView } from "@/lib/demo-view/DemoViewContext";

export function useDemoMatchCapturePermissions(
  real: MatchCapturePermissions,
  matchStatus: MatchStatusValue
): MatchCapturePermissions {
  const { getMatchCapturePermissions } = useDemoView();
  return getMatchCapturePermissions(real, matchStatus);
}
