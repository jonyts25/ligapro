export type CredentialPdfDownloadProps =
  | {
      mode: "captain";
      seasonTeamId: string;
      seasonTeamPlayerId: string;
    }
  | {
      mode: "capture";
      organizationId: string;
      competitionId: string;
      seasonId: string;
      matchId: string;
      seasonTeamPlayerId: string;
    };

export function CredentialPdfDownload(props: CredentialPdfDownloadProps) {
  const query = new URLSearchParams({ mode: props.mode });

  if (props.mode === "captain") {
    query.set("seasonTeamId", props.seasonTeamId);
    query.set("seasonTeamPlayerId", props.seasonTeamPlayerId);
  } else {
    query.set("organizationId", props.organizationId);
    query.set("competitionId", props.competitionId);
    query.set("seasonId", props.seasonId);
    query.set("matchId", props.matchId);
    query.set("seasonTeamPlayerId", props.seasonTeamPlayerId);
  }

  return (
    <a
      href={`/api/export/credential?${query.toString()}`}
      className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-border bg-surface-elevated px-4 text-sm font-medium"
    >
      Descargar PDF
    </a>
  );
}
