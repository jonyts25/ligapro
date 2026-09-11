"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";

export type OrganizationSeasonOption = {
  seasonId: string;
  competitionId: string;
  label: string;
  competitionName: string;
};

type OrganizationSeasonPickerProps = {
  seasons: OrganizationSeasonOption[];
  selectedSeasonId: string;
};

export function OrganizationSeasonPicker({
  seasons,
  selectedSeasonId,
}: OrganizationSeasonPickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(seasonId: string) {
    const season = seasons.find((item) => item.seasonId === seasonId);
    if (!season) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("seasonId", season.seasonId);
    params.set("competitionId", season.competitionId);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <Card className="space-y-1.5">
      <label htmlFor="organization-season-picker" className="block text-sm font-medium">
        Torneo
      </label>
      <select
        id="organization-season-picker"
        value={selectedSeasonId}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
      >
        {seasons.map((season) => (
          <option key={season.seasonId} value={season.seasonId}>
            {season.competitionName} · {season.label}
          </option>
        ))}
      </select>
    </Card>
  );
}
