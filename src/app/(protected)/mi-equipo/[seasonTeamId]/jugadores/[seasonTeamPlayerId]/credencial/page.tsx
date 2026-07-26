import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { getCaptainTeamContext } from "@/lib/captain/queries";
import { getPlayerCredentialForCaptain } from "@/lib/players/queries";
import { PlayerCredentialCard } from "@/components/players/PlayerCredentialCard";

type PageProps = {
  params: Promise<{ seasonTeamId: string; seasonTeamPlayerId: string }>;
};

export default async function CaptainPlayerCredentialPage({ params }: PageProps) {
  const { seasonTeamId, seasonTeamPlayerId } = await params;
  const user = await requireUser();
  const team = await getCaptainTeamContext(user.id, seasonTeamId);
  if (!team) notFound();

  const credential = await getPlayerCredentialForCaptain(
    user.id,
    seasonTeamId,
    seasonTeamPlayerId
  );
  if (!credential) notFound();

  const revalidatePaths = [
    `/mi-equipo/${seasonTeamId}`,
    `/mi-equipo/${seasonTeamId}/jugadores/${seasonTeamPlayerId}/credencial`,
  ];

  return (
    <div className="space-y-5 pb-10">
      <Link
        href={`/mi-equipo/${seasonTeamId}`}
        className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium"
      >
        Volver al plantel
      </Link>
      <PlayerCredentialCard
        credential={credential}
        revalidatePaths={revalidatePaths}
        pdfDownload={{
          mode: "captain",
          seasonTeamId,
          seasonTeamPlayerId,
        }}
      />
    </div>
  );
}
