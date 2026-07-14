import Image from "next/image";
import { formatLabel } from "@/lib/competitions/types";
import { getOrganizationLogoPublicUrl } from "@/lib/branding/map-organization-branding";
import type { PublicSeasonOverview } from "@/lib/public-season/types";

type PublicSeasonHeaderProps = {
  overview: PublicSeasonOverview;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "LP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function PublicSeasonHeader({ overview }: PublicSeasonHeaderProps) {
  const logoUrl = getOrganizationLogoPublicUrl(overview.organizationLogoPath);
  const dates =
    overview.startsOn || overview.endsOn
      ? `${overview.startsOn ?? "—"} → ${overview.endsOn ?? "—"}`
      : "Sin fechas publicadas";

  return (
    <header className="space-y-4 border-b border-border pb-6">
      <div className="flex items-center gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border text-sm font-bold"
          style={{
            backgroundColor: "var(--organization-accent)",
            color: "var(--brand-foreground)",
          }}
        >
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={`Logo de ${overview.organizationName}`}
              width={48}
              height={48}
              className="h-full w-full object-cover"
            />
          ) : (
            <span aria-hidden="true">{initials(overview.organizationName)}</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-text-primary sm:text-xl">
            {overview.organizationName}
          </p>
          <p className="truncate text-sm text-text-secondary">
            {overview.competitionName}
          </p>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
          {overview.seasonName}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          {formatLabel(overview.formatType)} · {dates}
        </p>
      </div>
    </header>
  );
}
