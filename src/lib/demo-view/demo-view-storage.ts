import type { DemoViewRole } from "@/lib/demo-view/types";
import { DEMO_VIEW_ROLES } from "@/lib/demo-view/types";

export const DEMO_VIEW_STORAGE_KEY = "ligapro-demo-view";

type StoredDemoViewState = {
  organizationId: string;
  viewAsRole: DemoViewRole;
};

export function isDemoViewRole(value: unknown): value is DemoViewRole {
  return (
    typeof value === "string" &&
    (DEMO_VIEW_ROLES as readonly string[]).includes(value)
  );
}

/**
 * Non-staff users always resolve to `'real'`, even if sessionStorage was tampered with.
 */
export function resolveDemoViewRole(
  storedRole: unknown,
  isPlatformStaff: boolean
): DemoViewRole {
  if (!isPlatformStaff) {
    return "real";
  }
  if (!isDemoViewRole(storedRole) || storedRole === "real") {
    return "real";
  }
  return storedRole;
}

export function readDemoViewFromSessionStorage(
  organizationId: string,
  isPlatformStaff: boolean
): DemoViewRole {
  if (!isPlatformStaff || typeof window === "undefined") {
    return "real";
  }

  try {
    const raw = window.sessionStorage.getItem(DEMO_VIEW_STORAGE_KEY);
    if (!raw) return "real";

    const parsed = JSON.parse(raw) as Partial<StoredDemoViewState>;
    if (parsed.organizationId !== organizationId) {
      return "real";
    }

    return resolveDemoViewRole(parsed.viewAsRole, isPlatformStaff);
  } catch {
    return "real";
  }
}

export function writeDemoViewToSessionStorage(
  organizationId: string,
  viewAsRole: DemoViewRole
): void {
  if (typeof window === "undefined") return;

  if (viewAsRole === "real") {
    window.sessionStorage.removeItem(DEMO_VIEW_STORAGE_KEY);
    return;
  }

  const payload: StoredDemoViewState = { organizationId, viewAsRole };
  window.sessionStorage.setItem(DEMO_VIEW_STORAGE_KEY, JSON.stringify(payload));
}

export function clearDemoViewSessionStorage(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(DEMO_VIEW_STORAGE_KEY);
}
