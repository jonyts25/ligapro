"use client";

/**
 * SECURITY — RENDERING ONLY
 * This demo-view mechanism changes UI visibility for platform_staff demos.
 * It MUST NOT be used to bypass authorization in server actions, RPCs, RLS, or
 * any server-side permission check. Any future work that wires viewAsRole into
 * server-side code requires an explicit security review before implementation.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { DemoViewRole } from "@/lib/demo-view/types";
import {
  readDemoViewFromSessionStorage,
  writeDemoViewToSessionStorage,
} from "@/lib/demo-view/demo-view-storage";
import {
  applyDemoMatchCapturePermissions,
  getDemoCanManageActive,
  getDemoDisplayRoleLabel,
  getDemoNavOptions,
  isDemoViewSimulating,
  shouldShowCaptainPortalNotice,
  shouldShowMisPartidosForDemoRole,
  shouldShowPlatformStaffNav,
} from "@/lib/demo-view/demo-view-permissions";
import type { OrganizationNavOptions } from "@/components/layout/nav-items";
import type {
  MatchCapturePermissions,
  MatchStatusValue,
} from "@/lib/matches/types";

type DemoViewContextValue = {
  viewAsRole: DemoViewRole;
  isPlatformStaff: boolean;
  isSimulating: boolean;
  setViewAsRole: (role: DemoViewRole) => void;
  getNavOptions: (realCanManageSettings: boolean) => OrganizationNavOptions;
  getDisplayRoleLabel: (realRoleLabel: string | null | undefined) => string | null;
  getCanManageActive: (realCanManageActive: boolean) => boolean;
  getMatchCapturePermissions: (
    real: MatchCapturePermissions,
    matchStatus: MatchStatusValue
  ) => MatchCapturePermissions;
  showPlatformStaffNav: boolean;
  showMisPartidosNav: boolean;
  showCaptainPortalNotice: boolean;
  hasCaptainTeams: boolean;
  hasOfficialAssignments: boolean;
};

const DemoViewContext = createContext<DemoViewContextValue | null>(null);

type DemoViewProviderProps = {
  organizationId: string;
  isPlatformStaff: boolean;
  hasCaptainTeams: boolean;
  hasOfficialAssignments: boolean;
  children: ReactNode;
};

export function DemoViewProvider({
  organizationId,
  isPlatformStaff,
  hasCaptainTeams,
  hasOfficialAssignments,
  children,
}: DemoViewProviderProps) {
  const [viewAsRole, setViewAsRoleState] = useState<DemoViewRole>(() =>
    readDemoViewFromSessionStorage(organizationId, isPlatformStaff)
  );

  const setViewAsRole = useCallback(
    (role: DemoViewRole) => {
      if (!isPlatformStaff) {
        setViewAsRoleState("real");
        return;
      }
      const nextRole = role === "real" ? "real" : role;
      writeDemoViewToSessionStorage(organizationId, nextRole);
      setViewAsRoleState(nextRole);
    },
    [isPlatformStaff, organizationId]
  );

  const value = useMemo<DemoViewContextValue>(() => {
    const isSimulating = isDemoViewSimulating(viewAsRole, isPlatformStaff);

    return {
      viewAsRole,
      isPlatformStaff,
      isSimulating,
      setViewAsRole,
      getNavOptions: (realCanManageSettings) =>
        getDemoNavOptions(viewAsRole, isPlatformStaff, realCanManageSettings),
      getDisplayRoleLabel: (realRoleLabel) =>
        getDemoDisplayRoleLabel(viewAsRole, isPlatformStaff, realRoleLabel),
      getCanManageActive: (realCanManageActive) =>
        getDemoCanManageActive(viewAsRole, isPlatformStaff, realCanManageActive),
      getMatchCapturePermissions: (real, matchStatus) =>
        applyDemoMatchCapturePermissions(
          real,
          viewAsRole,
          isPlatformStaff,
          matchStatus
        ),
      showPlatformStaffNav: shouldShowPlatformStaffNav(
        viewAsRole,
        isPlatformStaff
      ),
      showMisPartidosNav: shouldShowMisPartidosForDemoRole(
        viewAsRole,
        isPlatformStaff
      ),
      showCaptainPortalNotice: shouldShowCaptainPortalNotice(
        viewAsRole,
        isPlatformStaff
      ),
      hasCaptainTeams,
      hasOfficialAssignments,
    };
  }, [
    viewAsRole,
    isPlatformStaff,
    setViewAsRole,
    hasCaptainTeams,
    hasOfficialAssignments,
  ]);

  return (
    <DemoViewContext.Provider value={value}>{children}</DemoViewContext.Provider>
  );
}

export function useDemoView(): DemoViewContextValue {
  const context = useContext(DemoViewContext);
  if (!context) {
    throw new Error("useDemoView must be used within DemoViewProvider");
  }
  return context;
}

export function useOptionalDemoView(): DemoViewContextValue | null {
  return useContext(DemoViewContext);
}
