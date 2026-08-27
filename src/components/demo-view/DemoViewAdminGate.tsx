"use client";

import type { ReactNode } from "react";
import { useDemoView } from "@/lib/demo-view/DemoViewContext";

type DemoViewAdminGateProps = {
  realCanManage: boolean;
  children: ReactNode;
};

export function DemoViewAdminGate({
  realCanManage,
  children,
}: DemoViewAdminGateProps) {
  const { getCanManageActive } = useDemoView();
  if (!getCanManageActive(realCanManage)) {
    return null;
  }
  return children;
}

type DemoViewCaptureLinkGateProps = {
  realCanCapture: boolean;
  children: ReactNode;
};

export function DemoViewCaptureLinkGate({
  realCanCapture,
  children,
}: DemoViewCaptureLinkGateProps) {
  const { isSimulating, viewAsRole } = useDemoView();

  if (!realCanCapture && !(isSimulating && viewAsRole === "owner_admin")) {
    return null;
  }

  if (
    isSimulating &&
    (viewAsRole === "captain" ||
      ((viewAsRole === "referee" || viewAsRole === "scorekeeper") &&
        !realCanCapture))
  ) {
    return null;
  }

  return children;
}
