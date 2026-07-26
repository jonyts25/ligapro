import Link from "next/link";
import type { CaptainTeamLink } from "@/lib/captain/types";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

type CaptainTeamPickerProps = {
  teams: CaptainTeamLink[];
};

export function CaptainTeamPicker({ teams }: CaptainTeamPickerProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Mis equipos"
        description="Elige el equipo que quieres administrar como capitán o vicecapitán."
      />
      <ul className="grid gap-4">
        {teams.map((team) => (
          <li key={team.seasonTeamId}>
            <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">{team.teamName}</p>
                <p className="text-sm text-text-secondary">
                  {team.competitionName} · {team.seasonName}
                </p>
                <p className="text-xs text-muted">
                  Rol:{" "}
                  {team.leadershipRole === "captain"
                    ? "Capitán"
                    : "Vicecapitán"}
                </p>
              </div>
              <Link
                href={`/mi-equipo/${team.seasonTeamId}`}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
              >
                Entrar
              </Link>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
