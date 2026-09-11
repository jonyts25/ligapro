"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils/cn";

type MatchdayTabsProps = {
  rounds: number[];
  selectedRound: number | "all";
  basePath: string;
};

export function MatchdayTabs({
  rounds,
  selectedRound,
  basePath,
}: MatchdayTabsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filtro = searchParams.get("filtro");

  const items: Array<{ value: number | "all"; label: string }> = [
    { value: "all", label: "Todas" },
    ...rounds.map((r) => ({ value: r as number | "all", label: `J${r}` })),
  ];

  function hrefFor(value: number | "all"): string {
    const params = new URLSearchParams();
    if (value !== "all") {
      params.set("jornada", String(value));
    }
    if (filtro && filtro !== "todas") {
      params.set("filtro", filtro);
    }
    const qs = params.toString();
    const path = basePath || pathname;
    return qs ? `${path}?${qs}` : path;
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {items.map((item) => {
        const active = selectedRound === item.value;
        return (
          <Link
            key={String(item.value)}
            href={hrefFor(item.value)}
            scroll={false}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center rounded-xl border px-4 text-sm font-medium",
              active
                ? "border-brand bg-brand text-brand-foreground"
                : "border-border text-text-secondary hover:bg-surface-elevated"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
