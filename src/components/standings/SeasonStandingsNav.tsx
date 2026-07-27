import Link from "next/link";
import { cn } from "@/lib/utils/cn";

type SeasonStandingsNavProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  active:
    | "temporada"
    | "dashboard"
    | "calendario"
    | "posiciones"
    | "bracket"
    | "grupos"
    | "goleadores"
    | "disciplina"
    | "finanzas"
    | "canchas";
  canManage?: boolean;
  /** When set, hides operational write sections (grupos, canchas) but not finanzas. */
  canManageActive?: boolean;
  formatType?: string;
};

const BASE_LINKS = [
  { key: "temporada", label: "Temporada", path: "" },
  { key: "dashboard", label: "Dashboard", path: "/dashboard" },
  { key: "calendario", label: "Calendario", path: "/calendario" },
] as const;

export function SeasonStandingsNav({
  organizationId,
  competitionId,
  seasonId,
  active,
  canManage = false,
  canManageActive,
  formatType = "round_robin",
}: SeasonStandingsNavProps) {
  const base = `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}`;
  const activeOps = canManageActive ?? canManage;

  const formatLinks: Array<{
    key: SeasonStandingsNavProps["active"];
    label: string;
    path: string;
  }> = [];

  if (formatType === "groups_knockout") {
    if (activeOps) {
      formatLinks.push({ key: "grupos", label: "Grupos", path: "/grupos" });
    }
    formatLinks.push({ key: "posiciones", label: "Posiciones", path: "/posiciones" });
    formatLinks.push({ key: "bracket", label: "Eliminatoria", path: "/bracket" });
  } else if (formatType === "knockout") {
    formatLinks.push({ key: "bracket", label: "Eliminatoria", path: "/bracket" });
  } else {
    formatLinks.push({ key: "posiciones", label: "Posiciones", path: "/posiciones" });
  }

  const tailLinks = [
    { key: "goleadores" as const, label: "Goleadores", path: "/goleadores" },
    { key: "disciplina" as const, label: "Disciplina", path: "/disciplina" },
  ];

  const adminLinks = canManage
    ? [
        ...(activeOps
          ? [{ key: "canchas" as const, label: "Canchas", path: "/canchas" }]
          : []),
        { key: "finanzas" as const, label: "Finanzas", path: "/finanzas" },
      ]
    : [];

  const links = [...BASE_LINKS, ...formatLinks, ...tailLinks, ...adminLinks];

  return (
    <nav
      aria-label="Secciones de la temporada"
      className="flex flex-wrap gap-2"
    >
      {links.map((link) => {
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
