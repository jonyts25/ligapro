import { requireUser } from "@/lib/auth/require-user";
import { getCaptainTeams } from "@/lib/auth/get-captain-teams";
import { getCaptainProfile } from "@/lib/captain/queries";
import { CaptainProfileForm } from "@/components/captain/CaptainProfileForm";
import { redirect } from "next/navigation";

export default async function CaptainProfilePage() {
  const user = await requireUser("/iniciar-sesion?next=/mi-equipo/perfil");
  const teams = await getCaptainTeams(user.id);
  if (teams.length === 0) {
    redirect("/onboarding");
  }

  const profile = await getCaptainProfile(user.id);
  if (!profile) {
    redirect("/onboarding");
  }

  return (
    <CaptainProfileForm
      displayName={profile.displayName}
      email={profile.email}
      phone={profile.phone}
    />
  );
}
