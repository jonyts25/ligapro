import type { GeneratedFixture } from "@/lib/fixtures/round-robin";

type FixturePreviewProps = {
  fixture: GeneratedFixture;
  teamNames: Map<string, string>;
};

export function FixturePreview({ fixture, teamNames }: FixturePreviewProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">
        {fixture.rounds.length} jornada{fixture.rounds.length === 1 ? "" : "s"} ·{" "}
        {fixture.matches.length} partido
        {fixture.matches.length === 1 ? "" : "s"} · modalidad{" "}
        {fixture.mode === "double" ? "ida y vuelta" : "una vuelta"}
      </p>
      <ul className="space-y-3">
        {fixture.rounds.map((round) => (
          <li
            key={round.roundNumber}
            className="rounded-xl border border-border px-3 py-3"
          >
            <p className="text-sm font-semibold text-text-primary">
              Jornada {round.roundNumber}
              {round.legNumber === 2 ? " · Vuelta 2" : ""}
            </p>
            {round.byeSeasonTeamId && (
              <p className="mt-1 text-xs text-text-secondary">
                Descansa:{" "}
                {teamNames.get(round.byeSeasonTeamId) ?? "Equipo"}
              </p>
            )}
            <ul className="mt-2 space-y-1 text-sm text-text-secondary">
              {round.matches.map((match) => (
                <li key={`${match.roundNumber}-${match.sequenceInRound}`}>
                  {teamNames.get(match.homeSeasonTeamId) ?? "Local"} vs{" "}
                  {teamNames.get(match.awaySeasonTeamId) ?? "Visitante"}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
