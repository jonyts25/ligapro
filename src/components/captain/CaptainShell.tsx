import Link from "next/link";
import type { ReactNode } from "react";
import type { CurrentUser } from "@/lib/auth/types";
import type { CaptainTeamLink } from "@/lib/captain/types";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { cn } from "@/lib/utils/cn";

type CaptainShellProps = {
  user: CurrentUser;
  teams: CaptainTeamLink[];
  activeSeasonTeamId?: string;
  children: ReactNode;
};

export function CaptainShell({
  user,
  teams,
  activeSeasonTeamId,
  children,
}: CaptainShellProps) {
  const activeTeam =
    teams.find((t) => t.seasonTeamId === activeSeasonTeamId) ?? teams[0];

  return (
    <div className="min-h-dvh bg-background text-text-primary">
      <header className="border-b border-border bg-surface-elevated/40">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Portal del capitán
            </p>
            <h1 className="text-lg font-semibold">
              {activeTeam?.teamName ?? "Mi equipo"}
            </h1>
            {activeTeam && (
              <p className="text-sm text-text-secondary">
                {activeTeam.competitionName} · {activeTeam.seasonName}
              </p>
            )}
          </div>
          <SignOutButton />
        </div>
        {teams.length > 1 && (
          <nav
            className="mx-auto flex max-w-3xl gap-2 overflow-x-auto px-4 pb-3 sm:px-6"
            aria-label="Equipos"
          >
            {teams.map((team) => (
              <Link
                key={team.seasonTeamId}
                href={`/mi-equipo/${team.seasonTeamId}`}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium",
                  team.seasonTeamId === activeSeasonTeamId
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-border text-text-secondary hover:border-brand/40"
                )}
              >
                {team.teamName}
              </Link>
            ))}
          </nav>
        )}
        {activeSeasonTeamId && (
          <nav
            className="mx-auto flex max-w-3xl gap-4 border-t border-border px-4 py-2 text-sm sm:px-6"
            aria-label="Secciones"
          >
            <Link
              href={`/mi-equipo/${activeSeasonTeamId}`}
              className="font-medium text-brand hover:underline"
            >
              Calendario y plantel
            </Link>
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">{children}</main>
      <footer className="mx-auto max-w-3xl px-4 pb-8 text-xs text-muted sm:px-6">
        Sesión: {user.displayName ?? user.email}
      </footer>
    </div>
  );
}
