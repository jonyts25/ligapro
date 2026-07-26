type SeasonExportButtonsProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  exportKind: "standings" | "scorers" | "discipline";
};

const ENDPOINTS = {
  standings: "/api/export/standings",
  scorers: "/api/export/scorers",
  discipline: "/api/export/discipline",
} as const;

function buildHref(
  kind: SeasonExportButtonsProps["exportKind"],
  props: Omit<SeasonExportButtonsProps, "exportKind">,
  format: "csv" | "pdf"
) {
  const query = new URLSearchParams({
    organizationId: props.organizationId,
    competitionId: props.competitionId,
    seasonId: props.seasonId,
    format,
  });
  return `${ENDPOINTS[kind]}?${query.toString()}`;
}

export function SeasonExportButtons(props: SeasonExportButtonsProps) {
  const { exportKind, ...rest } = props;

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={buildHref(exportKind, rest, "csv")}
        className="inline-flex min-h-10 items-center rounded-xl border border-border bg-surface-elevated px-4 text-sm font-medium"
      >
        Exportar CSV
      </a>
      <a
        href={buildHref(exportKind, rest, "pdf")}
        className="inline-flex min-h-10 items-center rounded-xl border border-border bg-surface-elevated px-4 text-sm font-medium"
      >
        Exportar PDF
      </a>
    </div>
  );
}

type RosterExportButtonsProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  seasonTeamId: string;
};

export function RosterExportButtons(props: RosterExportButtonsProps) {
  const query = new URLSearchParams({
    organizationId: props.organizationId,
    competitionId: props.competitionId,
    seasonId: props.seasonId,
    seasonTeamId: props.seasonTeamId,
  });

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={`/api/export/roster?${query.toString()}&format=csv`}
        className="inline-flex min-h-10 items-center rounded-xl border border-border bg-surface-elevated px-4 text-sm font-medium"
      >
        Exportar plantel CSV
      </a>
      <a
        href={`/api/export/roster?${query.toString()}&format=pdf`}
        className="inline-flex min-h-10 items-center rounded-xl border border-border bg-surface-elevated px-4 text-sm font-medium"
      >
        Exportar plantel PDF
      </a>
    </div>
  );
}
