import type { OrganizationActionState } from "@/lib/organizations/action-types";

export type { OrganizationActionState };

export const initialOrganizationActionState: OrganizationActionState = {
  ok: false,
  message: null,
};
