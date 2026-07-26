import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getCaptainInvitationByToken } from "@/lib/captain/queries";
import { CaptainInvitationAcceptPanel } from "@/components/captain/CaptainInvitationAcceptPanel";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function CaptainInvitationPage({ params }: PageProps) {
  const { token } = await params;
  const user = await getCurrentUser();

  const { preview, reason } = await getCaptainInvitationByToken(
    user?.id ?? null,
    user?.email ?? null,
    token
  );

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <CaptainInvitationAcceptPanel
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
