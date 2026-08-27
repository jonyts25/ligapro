"use client";

import Link from "next/link";
import { MatchRescheduleAdminPanel } from "@/components/fixtures/MatchRescheduleAdminPanel";
import { MatchOfficialsManager } from "@/components/matches/MatchOfficialsManager";
import { MatchTimeline } from "@/components/matches/MatchTimeline";
import { MatchChroniclePanel } from "@/components/matches/MatchChroniclePanel";
import { CapturePermissionBadge } from "@/components/matches/CapturePermissionBadge";
import {
  DemoViewAdminGate,
  DemoViewCaptureLinkGate,
} from "@/components/demo-view/DemoViewAdminGate";
import { useDemoMatchCapturePermissions } from "@/components/demo-view/useDemoMatchCapturePermissions";
import { useDemoView } from "@/lib/demo-view/DemoViewContext";
import type { MatchRescheduleRequestRow } from "@/lib/fixtures/types";
import type {
  MatchChronicleJobRow,
  MatchChronicleRow,
} from "@/lib/chronicles/types";
import type {
  MatchCapturePermissions,
  MatchOfficialListItem,
  MatchStatusValue,
  MatchTimelineEvent,
  OrgMemberOption,
} from "@/lib/matches/types";

type MatchDetailCaptureActionsProps = {
  base: string;
  matchId: string;
  seasonActive: boolean;
  realPermissions: MatchCapturePermissions;
};

export function MatchDetailCaptureActions({
  base,
  matchId,
  seasonActive,
  realPermissions,
}: MatchDetailCaptureActionsProps) {
  const realCanCapture =
    realPermissions.canCaptureEvents || realPermissions.canUpdateResult;

  if (!seasonActive) {
    return null;
  }

  return (
    <DemoViewCaptureLinkGate realCanCapture={realCanCapture}>
      <Link
        href={`${base}/partidos/${matchId}/captura`}
        className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
      >
        Capturar
      </Link>
    </DemoViewCaptureLinkGate>
  );
}

type MatchDetailCapturePermissionBadgeProps = {
  realPermissions: MatchCapturePermissions;
  matchStatus: MatchStatusValue;
};

export function MatchDetailCapturePermissionBadge({
  realPermissions,
  matchStatus,
}: MatchDetailCapturePermissionBadgeProps) {
  const permissions = useDemoMatchCapturePermissions(
    realPermissions,
    matchStatus
  );

  return (
    <CapturePermissionBadge
      canCaptureEvents={permissions.canCaptureEvents}
      canUpdateResult={permissions.canUpdateResult}
    />
  );
}

type MatchDetailProgramLinkProps = {
  base: string;
  matchId: string;
  isProgrammed: boolean;
  realCanManageActive: boolean;
  matchStatus: string;
};

export function MatchDetailProgramLink({
  base,
  matchId,
  isProgrammed,
  realCanManageActive,
  matchStatus,
}: MatchDetailProgramLinkProps) {
  if (matchStatus !== "scheduled") {
    return null;
  }

  return (
    <DemoViewAdminGate realCanManage={realCanManageActive}>
      <Link
        href={`${base}/partidos/${matchId}/programar`}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-border px-4 text-sm font-medium"
      >
        {isProgrammed ? "Reprogramar" : "Programar"}
      </Link>
    </DemoViewAdminGate>
  );
}

type MatchDetailReschedulePanelProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  matchId: string;
  isProgrammed: boolean;
  calendarStatus: "programado" | "confirmado";
  rescheduleRequest: MatchRescheduleRequestRow | null;
  realCanManageActive: boolean;
};

export function MatchDetailReschedulePanel(
  props: MatchDetailReschedulePanelProps
) {
  const { realCanManageActive, ...panelProps } = props;

  return (
    <DemoViewAdminGate realCanManage={realCanManageActive}>
      <MatchRescheduleAdminPanel {...panelProps} />
    </DemoViewAdminGate>
  );
}

type MatchDetailOfficialsManagerProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  matchId: string;
  matchStatus: string;
  members: OrgMemberOption[];
  officials: MatchOfficialListItem[];
  realCanManageActive: boolean;
};

export function MatchDetailOfficialsManager({
  realCanManageActive,
  ...props
}: MatchDetailOfficialsManagerProps) {
  const { getCanManageActive } = useDemoView();

  return (
    <MatchOfficialsManager
      {...props}
      canManage={getCanManageActive(realCanManageActive)}
    />
  );
}

type MatchDetailTimelineProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  matchId: string;
  events: MatchTimelineEvent[];
  realPermissions: MatchCapturePermissions;
  matchStatus: MatchStatusValue;
};

export function MatchDetailTimeline({
  realPermissions,
  matchStatus,
  ...props
}: MatchDetailTimelineProps) {
  const permissions = useDemoMatchCapturePermissions(
    realPermissions,
    matchStatus
  );

  return <MatchTimeline {...props} canVoidEvents={permissions.canVoidEvents} />;
}

type MatchDetailChroniclePanelProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  matchId: string;
  matchFinished: boolean;
  realCanManageActive: boolean;
  chronicle: MatchChronicleRow | null;
  job: MatchChronicleJobRow | null;
};

export function MatchDetailChroniclePanel({
  realCanManageActive,
  ...props
}: MatchDetailChroniclePanelProps) {
  const { getCanManageActive } = useDemoView();

  return (
    <MatchChroniclePanel
      {...props}
      canManage={getCanManageActive(realCanManageActive)}
    />
  );
}
