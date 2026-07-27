import Link from "next/link";
import { cn } from "@/lib/utils/cn";

type GroupTab = {
  id: string;
  name: string;
};

type GroupStandingsTabsProps = {
  groups: GroupTab[];
  selectedGroupId: string;
  basePath: string;
  paramName?: string;
};

export function GroupStandingsTabs({
  groups,
  selectedGroupId,
  basePath,
  paramName = "grupo",
}: GroupStandingsTabsProps) {
  if (groups.length <= 1) return null;

  return (
    <nav
      aria-label="Grupos"
      className="flex flex-wrap gap-2"
    >
      {groups.map((group) => {
        const isActive = group.id === selectedGroupId;
        const href = `${basePath}?${paramName}=${encodeURIComponent(group.id)}`;
        return (
          <Link
            key={group.id}
            href={href}
            className={cn(
              "inline-flex min-h-11 items-center rounded-xl border px-3 text-sm font-medium",
              isActive
                ? "border-organization-accent/40 bg-organization-accent/15 text-text-primary"
                : "border-border text-text-secondary hover:bg-surface-elevated"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {group.name}
          </Link>
        );
      })}
    </nav>
  );
}

type PublicGroupStandingsTabsProps = {
  groups: GroupTab[];
  selectedGroupName: string;
  basePath: string;
};

export function PublicGroupStandingsTabs({
  groups,
  selectedGroupName,
  basePath,
}: PublicGroupStandingsTabsProps) {
  if (groups.length <= 1) return null;

  return (
    <nav aria-label="Grupos" className="flex flex-wrap gap-2">
      {groups.map((group) => {
        const isActive = group.name === selectedGroupName;
        const href = `${basePath}?grupo=${encodeURIComponent(group.name)}`;
        return (
          <Link
            key={group.id}
            href={href}
            className={cn(
              "inline-flex min-h-11 items-center rounded-xl border px-3 text-sm font-medium",
              isActive
                ? "border-organization-accent/40 bg-organization-accent/15 text-text-primary"
                : "border-border text-text-secondary hover:bg-surface-elevated"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {group.name}
          </Link>
        );
      })}
    </nav>
  );
}
