import type { OrganizationNavOptions } from "@/components/layout/nav-items";
import type { DemoViewRole } from "@/lib/demo-view/types";
import { DEMO_VIEW_ROLE_LABELS } from "@/lib/demo-view/types";
import {
  isResultClosedStatus,
  type UpdateResultPermissions,
} from "@/lib/matches/update-result-permissions";
import type { MatchCapturePermissions, MatchStatusValue } from "@/lib/matches/types";

export function isDemoViewSimulating(
  viewAsRole: DemoViewRole,
  isPlatformStaff: boolean
): boolean {
  return isPlatformStaff && viewAsRole !== "real";
}

export function getDemoNavOptions(
  viewAsRole: DemoViewRole,
  isPlatformStaff: boolean,
  realCanManageSettings: boolean
): OrganizationNavOptions {
  if (!isDemoViewSimulating(viewAsRole, isPlatformStaff)) {
    return { canManageSettings: realCanManageSettings };
  }

  if (viewAsRole === "owner_admin") {
    return { canManageSettings: true };
  }

  return { canManageSettings: false };
}

export function getDemoDisplayRoleLabel(
  viewAsRole: DemoViewRole,
  isPlatformStaff: boolean,
  realRoleLabel: string | null | undefined
): string | null {
  if (!isDemoViewSimulating(viewAsRole, isPlatformStaff)) {
    return realRoleLabel ?? null;
  }
  return DEMO_VIEW_ROLE_LABELS[viewAsRole];
}

export function getDemoCanManageActive(
  viewAsRole: DemoViewRole,
  isPlatformStaff: boolean,
  realCanManageActive: boolean
): boolean {
  if (!isDemoViewSimulating(viewAsRole, isPlatformStaff)) {
    return realCanManageActive;
  }

  return viewAsRole === "owner_admin";
}

export function applyDemoMatchCapturePermissions(
  real: MatchCapturePermissions,
  viewAsRole: DemoViewRole,
  isPlatformStaff: boolean,
  matchStatus: MatchStatusValue
): MatchCapturePermissions {
  if (!isDemoViewSimulating(viewAsRole, isPlatformStaff)) {
    return real;
  }

  switch (viewAsRole) {
    case "owner_admin":
      return {
        ...real,
        canCaptureEvents: real.captureWindowBypass || real.captureWindowOpen,
        canUpdateResult: true,
        closeOnlyResultUpdate: false,
        canManageOfficials: true,
        canManageSeasonRoles: true,
        canVoidEvents: true,
        captureWindowBypass: true,
        actorLabel: "Admin de organización (demo)",
      };
    case "referee": {
      const refereeResult: UpdateResultPermissions = {
        canUpdateResult: !isResultClosedStatus(matchStatus),
        closeOnlyResultUpdate: true,
      };
      return {
        ...real,
        canCaptureEvents: real.canCaptureEvents,
        canUpdateResult: refereeResult.canUpdateResult,
        closeOnlyResultUpdate: refereeResult.closeOnlyResultUpdate,
        canManageOfficials: false,
        canManageSeasonRoles: false,
        canVoidEvents: false,
        captureWindowBypass: false,
        actorLabel: "Árbitro confirmado (demo)",
      };
    }
    case "scorekeeper":
      return {
        ...real,
        canCaptureEvents:
          real.canCaptureEvents ||
          (real.captureWindowOpen && !isResultClosedStatus(matchStatus)),
        canUpdateResult: false,
        closeOnlyResultUpdate: false,
        canManageOfficials: false,
        canManageSeasonRoles: false,
        canVoidEvents: false,
        captureWindowBypass: false,
        actorLabel: "Anotador (demo)",
      };
    case "captain":
      return {
        ...real,
        canCaptureEvents: false,
        canUpdateResult: false,
        closeOnlyResultUpdate: false,
        canManageOfficials: false,
        canManageSeasonRoles: false,
        canVoidEvents: false,
        captureWindowBypass: false,
        actorLabel: "Capitán (demo)",
      };
    default:
      return real;
  }
}

export function shouldShowPlatformStaffNav(
  viewAsRole: DemoViewRole,
  isPlatformStaff: boolean
): boolean {
  return isPlatformStaff && viewAsRole === "real";
}

export function shouldShowMisPartidosForDemoRole(
  viewAsRole: DemoViewRole,
  isPlatformStaff: boolean
): boolean {
  if (!isDemoViewSimulating(viewAsRole, isPlatformStaff)) {
    return true;
  }
  return viewAsRole === "referee" || viewAsRole === "scorekeeper";
}

export function shouldShowCaptainPortalNotice(
  viewAsRole: DemoViewRole,
  isPlatformStaff: boolean
): boolean {
  return isDemoViewSimulating(viewAsRole, isPlatformStaff) && viewAsRole === "captain";
}
