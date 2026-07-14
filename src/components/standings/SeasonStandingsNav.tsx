import Link from "next/link";
import { cn } from "@/lib/utils/cn";

type SeasonStandingsNavProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  active:
    | "temporada"
    | "calendario"
    | "posiciones"
    | "goleadores"
    | "disciplina";
};

const LINKS = [
  { key: "temporada", label: "Temporada", path: "" },
  { key: "calendario", label: "Calendario", path: "/calendario" },
  { key: "posiciones", label: "Posiciones", path: "/posiciones" },
  { key: "goleadores", label: "Goleadores", path: "/goleadores" },
  { key: "disciplina", label: "Disciplina", path: "/disciplina" },
] as const;

export function SeasonStandingsNav({
  organizationId,
  competitionId,
  seasonId,
  active,
}: SeasonStandingsNavProps) {
  const base = `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}`;

  return (
    <nav
      aria-label="Secciones de la temporada"
      className="flex flex-wrap gap-2"
    >
      {LINKS.map((link) => {
        const href = `${base}${link.path}`;
        const isActive = link.key === active;
        return (
          <Link
            key={link.key}
            href={href}
            className={cn(
              "inline-flex min-h-11 items-center rounded-xl border px-3 text-sm font-medium",
              isActive
                ? "border-organization-accent/40 bg-organization-accent/15 text-text-primary"
                : "border-border text-text-secondary hover:bg-surface-elevated"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
