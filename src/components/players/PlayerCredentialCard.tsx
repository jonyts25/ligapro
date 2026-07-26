import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { PlayerVerificationBadge } from "@/components/players/PlayerVerificationBadge";
import { PlayerPhotoUploader } from "@/components/players/PlayerPhotoUploader";
import {
  CredentialPdfDownload,
  type CredentialPdfDownloadProps,
} from "@/components/export/CredentialPdfDownload";
import { Card } from "@/components/ui/Card";
import type { PlayerCredentialData } from "@/lib/players/types";

type PlayerCredentialCardProps = {
  credential: PlayerCredentialData;
  revalidatePaths?: string[];
  pdfDownload?: CredentialPdfDownloadProps;
};

export function PlayerCredentialCard({
  credential,
  revalidatePaths = [],
  pdfDownload,
}: PlayerCredentialCardProps) {
  return (
    <Card className="mx-auto max-w-sm space-y-5 text-center">
      <div className="flex flex-col items-center gap-4">
        <PlayerAvatar
          photoUrl={credential.photoUrl}
          name={credential.fullName}
          size="lg"
        />
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">{credential.fullName}</h1>
          <p className="text-sm text-text-secondary">{credential.teamName}</p>
          {credential.jerseyNumber != null && (
            <p className="text-sm font-medium">Dorsal {credential.jerseyNumber}</p>
          )}
          <div className="flex justify-center">
            <PlayerVerificationBadge
              status={credential.verificationStatus}
              visible={credential.requirePlayerVerification}
            />
          </div>
        </div>
      </div>
      {pdfDownload && <CredentialPdfDownload {...pdfDownload} />}
      <p className="text-xs text-muted">
        Credencial virtual de solo lectura. El PDF se genera al descargar y no se
        almacena en el servidor.
      </p>
      {credential.canUploadPhoto && (
        <div className="border-t border-border pt-4 text-left">
          <p className="mb-3 text-sm font-medium">Foto del jugador (opcional)</p>
          <PlayerPhotoUploader
            organizationId={credential.organizationId}
            playerId={credential.playerId}
            currentPhotoUrl={credential.photoUrl}
            currentPhotoPath={credential.photoPath}
            revalidatePaths={revalidatePaths}
          />
        </div>
      )}
    </Card>
  );
}
