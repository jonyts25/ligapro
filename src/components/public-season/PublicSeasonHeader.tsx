import { OrganizationBrand } from "@/components/branding/OrganizationBrand";
import { mapPublicSeasonOverviewToBranding } from "@/lib/branding/map-organization-branding";
import { formatLabel } from "@/lib/competitions/types";
import type { PublicSeasonOverview } from "@/lib/public-season/types";

type PublicSeasonHeaderProps = {
  overview: PublicSeasonOverview;
};

export function PublicSeasonHeader({ overview }: PublicSeasonHeaderProps) {
  const branding = mapPublicSeasonOverviewToBranding(overview);
  const dates =
    overview.startsOn || overview.endsOn
      ? `${overview.startsOn ?? "—"} → ${overview.endsOn ?? "—"}`
      : "Sin fechas publicadas";

  return (
    <header className="space-y-4 border-b border-border pb-6">
      <div className="flex items-center gap-3">
        <OrganizationBrand branding={branding} variant="compact" />
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
