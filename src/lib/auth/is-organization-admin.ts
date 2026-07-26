import type { OrganizationRole } from "@/lib/auth/types";

/** Owner/admin only — not captain, vice, member, nor tournament_admin season role. */
export function isOrganizationAdminRole(
  role: OrganizationRole | string | null | undefined
): boolean {
  return role === "organization_owner" || role === "organization_admin";
}

export type AdminUiSurface =
  | "finanzas_page"
  | "finanzas_nav_link"
  | "discipline_admin_panel"
  | "match_reschedule_admin_panel"
  | "match_programar_link"
  | "match_officials_manage";

/**
 * UI visibility for admin-only surfaces in the protected org app.
 * Captains/vice-captains are not organization_members today → no membership role.
 */
export function canShowAdminUiSurface(
  surface: AdminUiSurface,
  membershipRole: OrganizationRole | string | null | undefined
): boolean {
  if (!isOrganizationAdminRole(membershipRole)) {
    return false;
  }

  switch (surface) {
    case "finanzas_page":
    case "finanzas_nav_link":
    case "discipline_admin_panel":
    case "match_reschedule_admin_panel":
    case "match_programar_link":
    case "match_officials_manage":
      return true;
    default:
      return false;
  }
}
