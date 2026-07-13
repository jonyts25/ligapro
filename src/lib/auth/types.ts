export type CurrentUser = {
  id: string;
  email: string | null;
  displayName: string | null;
};

export type OrganizationRole =
  | "organization_owner"
  | "organization_admin"
  | "organization_member";

export type UserOrganizationMembership = {
  organizationId: string;
  organizationName: string;
  role: OrganizationRole;
};

export type AuthActionState = {
  ok: boolean;
  message: string | null;
  fieldErrors?: Record<string, string>;
};
