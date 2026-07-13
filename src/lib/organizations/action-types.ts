import type { AuthActionState } from "@/lib/auth/types";

export type OrganizationActionState = AuthActionState & {
  values?: {
    name?: string;
    brandColor?: string | null;
  };
};
