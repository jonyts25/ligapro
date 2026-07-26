import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { getCaptainTeams } from "@/lib/auth/get-captain-teams";
import { CaptainTeamPicker } from "@/components/captain/CaptainTeamPicker";
import { SignOutButton } from "@/components/layout/SignOutButton";

export default async function CaptainPortalHomePage() {
  const user = await requireUser();
  const teams = await getCaptainTeams(user.id);

  if (teams.length === 1) {
    redirect(`/mi-equipo/${teams[0].seasonTeamId}`);
  }

  return (
    <div className="min-h-dvh bg-background px-4 py-8 text-text-primary sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex justify-end">
          <SignOutButton />
        </div>
        <CaptainTeamPicker teams={teams} />
      </div>
    </div>
  );
}
