import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import type { PublicSeasonTab } from "@/lib/public-season/types";

type PublicSeasonNavigationProps = {
  organizationId: string;
  seasonSlug: string;
  active: PublicSeasonTab;
  formatType?: string;
};

export function PublicSeasonNavigation({
  organizationId,
  seasonSlug,
  active,
  formatType = "round_robin",
}: PublicSeasonNavigationProps) {
  const base = `/publico/${organizationId}/${seasonSlug}`;

  const tabs: Array<{ key: PublicSeasonTab; label: string; path: string }> = [
    { key: "inicio", label: "Inicio", path: "" },
    { key: "calendario", label: "Calendario", path: "/calendario" },
  ];

  if (formatType === "knockout") {
    tabs.push({
      key: "posiciones",
      label: "Eliminatoria",
      path: "/posiciones",
    });
  } else {
    tabs.push({
      key: "posiciones",
      label: "Posiciones",
      path: "/posiciones",
    });
  }

  tabs.push(
    { key: "goleadores", label: "Goleadores", path: "/goleadores" },
    { key: "disciplina", label: "Disciplina", path: "/disciplina" }
  );

  return (
    <nav
      aria-label="Secciones públicas"
      className="-mx-1 flex gap-1 overflow-x-auto pb-1"
    >
      {tabs.map((tab) => {
        const href = `${base}${tab.path}`;
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={href}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center rounded-xl border px-3 text-sm font-medium",
              isActive
                ? "border-organization-accent/40 bg-organization-accent/15 text-text-primary"
                : "border-transparent text-text-secondary hover:bg-surface-elevated"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
