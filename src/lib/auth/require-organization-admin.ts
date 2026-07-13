import { notFound } from "next/navigation";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import type { UserOrganizationMembership } from "@/lib/auth/types";

export async function requireOrganizationAdmin(
  profileId: string,
  organizationId: string
): Promise<UserOrganizationMembership> {
  const membership = await requireOrganizationMembership(
    profileId,
    organizationId
  );

  if (
    membership.role !== "organization_owner" &&
    membership.role !== "organization_admin"
  ) {
    notFound();
  }

  return membership;
}
