import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/require-user";
import { getCaptainTeams } from "@/lib/auth/get-captain-teams";
import { CaptainShell } from "@/components/captain/CaptainShell";

type LayoutProps = {
  children: ReactNode;
  params: Promise<{ seasonTeamId: string }>;
};

export default async function CaptainTeamLayout({
  children,
  params,
}: LayoutProps) {
  const { seasonTeamId } = await params;
  const user = await requireUser();
  const teams = await getCaptainTeams(user.id);

  return (
    <CaptainShell
      user={user}
      teams={teams}
      activeSeasonTeamId={seasonTeamId}
    >
      {children}
    </CaptainShell>
  );
}
