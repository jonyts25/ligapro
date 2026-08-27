"use client";

import type { ReactNode } from "react";
import { DemoViewProvider } from "@/lib/demo-view/DemoViewContext";
import { DemoViewBar } from "@/components/demo-view/DemoViewBar";

type DemoViewShellProps = {
  organizationId: string;
  isPlatformStaff: boolean;
  hasCaptainTeams: boolean;
  hasOfficialAssignments: boolean;
  children: ReactNode;
};

export function DemoViewShell({
  organizationId,
  isPlatformStaff,
  hasCaptainTeams,
  hasOfficialAssignments,
  children,
}: DemoViewShellProps) {
  return (
    <DemoViewProvider
      key={organizationId}
      organizationId={organizationId}
      isPlatformStaff={isPlatformStaff}
      hasCaptainTeams={hasCaptainTeams}
      hasOfficialAssignments={hasOfficialAssignments}
    >
      <DemoViewBar />
      {children}
    </DemoViewProvider>
  );
}
