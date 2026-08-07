import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getOrganizationInvitationByToken } from "@/lib/organization-members/invitation-queries";
import { OrganizationInvitationAcceptPanel } from "@/components/organizations/OrganizationInvitationAcceptPanel";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function OrganizationInvitationPage({ params }: PageProps) {
  const { token } = await params;
  const user = await getCurrentUser();

  const { preview, reason } = await getOrganizationInvitationByToken(
    user?.id ?? null,
    user?.email ?? null,
    token
  );

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <OrganizationInvitationAcceptPanel
          token={token}
          preview={preview}
          reason={reason}
          userEmail={user?.email}
          isAuthenticated={Boolean(user)}
        />
      </div>
    </div>
  );
}
