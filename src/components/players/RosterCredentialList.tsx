import Link from "next/link";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { PlayerVerificationBadge } from "@/components/players/PlayerVerificationBadge";
import type { RosterCredentialRow } from "@/lib/players/types";

type RosterCredentialListProps = {
  title: string;
  description?: string;
  rows: RosterCredentialRow[];
};

export function RosterCredentialList({
  title,
  description,
  rows,
}: RosterCredentialListProps) {
  if (rows.length === 0) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-text-secondary">{description}</p>
        )}
      </div>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.seasonTeamPlayerId}>
            <Link
              href={row.credentialHref}
              className="flex min-h-14 items-center gap-3 rounded-xl border border-border px-3 py-2 transition-colors hover:bg-surface-elevated"
            >
              <PlayerAvatar
                photoUrl={row.photoUrl}
                name={row.fullName}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">{row.fullName}</span>
                  <PlayerVerificationBadge
                    status={row.verificationStatus}
                    visible={row.requirePlayerVerification}
                  />
                </div>
                {row.jerseyNumber != null && (
                  <p className="text-xs text-text-secondary">
                    Dorsal {row.jerseyNumber}
                  </p>
                )}
              </div>
              <span className="text-xs font-medium text-accent">Credencial</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
