import type { OrganizationRole } from "@/lib/auth/types";

export type OrganizationMemberSeasonScope = {
  id: string;
  seasonId: string;
  seasonName: string;
};

export type OrganizationMemberListItem = {
  memberId: string;
  profileId: string;
  displayName: string;
  email: string;
  role: OrganizationRole;
  seasonScopes: OrganizationMemberSeasonScope[];
};

export type OrganizationSeasonScopeOption = {
  seasonId: string;
  label: string;
};

export type OrganizationInvitationPreview = {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  organizationName: string | null;
  isExpired: boolean;
};

export type OrganizationMembersActionState = {
  ok: boolean;
  message: string | null;
  inviteUrl?: string | null;
};

export const initialOrganizationMembersActionState: OrganizationMembersActionState =
  {
    ok: false,
    message: null,
  };
