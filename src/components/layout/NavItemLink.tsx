import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { isActiveRoute } from "@/components/layout/nav-items";

type NavItemLinkProps = {
  href: string;
  label: string;
  icon: LucideIcon;
  available: boolean;
  pathname: string;
  layout?: "sidebar" | "drawer";
  onNavigate?: () => void;
};

export function NavItemLink({
  href,
  label,
  icon: Icon,
  available,
  pathname,
  layout = "sidebar",
  onNavigate,
}: NavItemLinkProps) {
  const active = available && isActiveRoute(pathname, href);

  if (!available) {
    return (
      <span
        aria-disabled="true"
        title="Próximamente"
        className={cn(
          "flex min-h-11 cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium opacity-70",
          layout === "drawer" ? "w-full" : "",
          "text-text-secondary"
        )}
      >
        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="shrink-0 rounded-full border border-border bg-surface-elevated px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
          Próximamente
        </span>
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        layout === "drawer" ? "w-full" : "",
        active
          ? "bg-organization-accent/15 text-text-primary ring-1 ring-organization-accent/30"
          : "text-text-secondary hover:bg-surface-elevated hover:text-text-primary"
      )}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </Link>
  );
}
