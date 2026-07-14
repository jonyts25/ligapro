"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils/cn";

type MatchdayTabsProps = {
  rounds: number[];
  selectedRound: number | "all";
};

export function MatchdayTabs({ rounds, selectedRound }: MatchdayTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const items: Array<{ value: number | "all"; label: string }> = [
    { value: "all", label: "Todas" },
    ...rounds.map((r) => ({ value: r as number | "all", label: `J${r}` })),
  ];

  function select(value: number | "all") {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete("jornada");
    else params.set("jornada", String(value));
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {items.map((item) => {
        const active = selectedRound === item.value;
        return (
          <button
            key={String(item.value)}
            type="button"
            onClick={() => select(item.value)}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center rounded-xl border px-4 text-sm font-medium",
              active
                ? "border-brand bg-brand text-brand-foreground"
                : "border-border text-text-secondary"
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
