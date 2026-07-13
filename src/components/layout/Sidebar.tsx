"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { OrganizationBrand } from "@/components/branding/OrganizationBrand";
import type { OrganizationBranding } from "@/types/branding";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { NavItemLink } from "@/components/layout/NavItemLink";

type SidebarProps = {
  branding: OrganizationBranding;
  className?: string;
};

export function Sidebar({ branding, className }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "hidden h-full w-[var(--sidebar-width)] shrink-0 flex-col border-r border-border bg-surface lg:flex",
        className
      )}
      aria-label="Navegación principal"
    >
      <div className="border-b border-border px-4 py-5">
        <OrganizationBrand branding={branding} variant="full" />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <NavItemLink {...item} pathname={pathname} layout="sidebar" />
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-border px-4 py-4">
        <p className="text-xs text-muted">LigaPro · Panel operativo</p>
      </div>
    </aside>
  );
}
