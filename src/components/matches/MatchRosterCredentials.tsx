import { Card } from "@/components/ui/Card";
import { RosterCredentialList } from "@/components/players/RosterCredentialList";
import { resolvePlayerPhotoUrlMap } from "@/lib/players/photo-url";
import type { RosterCredentialRow } from "@/lib/players/types";
import type { MatchRosterPlayer } from "@/lib/matches/types";

type MatchRosterCredentialsProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  matchId: string;
  homeName: string;
  awayName: string;
  homeSeasonTeamId: string;
  awaySeasonTeamId: string;
  roster: MatchRosterPlayer[];
  requirePlayerVerification: boolean;
};

function buildRows(
  players: MatchRosterPlayer[],
  photoUrls: Map<string, string>,
  credentialBase: string,
  requirePlayerVerification: boolean
): RosterCredentialRow[] {
  return players
    .filter((p) => p.registrationStatus !== "inactive")
    .map((p) => ({
      seasonTeamPlayerId: p.seasonTeamPlayerId,
      playerId: p.playerId,
      fullName: p.playerName,
      jerseyNumber: p.jerseyNumber,
      photoUrl: p.photoPath ? (photoUrls.get(p.photoPath) ?? null) : null,
      verificationStatus: p.verificationStatus,
      requirePlayerVerification,
      registrationStatus: p.registrationStatus,
      credentialHref: `${credentialBase}/${p.seasonTeamPlayerId}`,
    }));
}

export async function MatchRosterCredentials({
  organizationId,
  competitionId,
  seasonId,
  matchId,
  homeName,
  awayName,
  homeSeasonTeamId,
  awaySeasonTeamId,
  roster,
  requirePlayerVerification,
}: MatchRosterCredentialsProps) {
  const photoUrls = await resolvePlayerPhotoUrlMap(
    roster.map((p) => p.photoPath)
  );
  const base = `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}/partidos/${matchId}/captura/jugadores`;

  const homeRows = buildRows(
    roster.filter((p) => p.seasonTeamId === homeSeasonTeamId),
    photoUrls,
    base,
    requirePlayerVerification
  );
  const awayRows = buildRows(
    roster.filter((p) => p.seasonTeamId === awaySeasonTeamId),
    photoUrls,
    base,
    requirePlayerVerification
  );

  if (homeRows.length === 0 && awayRows.length === 0) return null;

  return (
    <Card className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Credenciales del partido</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Consulta la credencial virtual de cada jugador. Solo lectura.
        </p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        {homeRows.length > 0 && (
          <RosterCredentialList title={homeName} rows={homeRows} />
        )}
        {awayRows.length > 0 && (
          <RosterCredentialList title={awayName} rows={awayRows} />
        )}
      </div>
    </Card>
  );
}
