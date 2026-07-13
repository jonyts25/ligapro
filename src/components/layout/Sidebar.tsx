"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { OrganizationBrand } from "@/components/branding/OrganizationBrand";
import type { OrganizationBranding } from "@/types/branding";
import type { CurrentUser } from "@/lib/auth/types";
import { getOrganizationNavItems } from "@/components/layout/nav-items";
import { NavItemLink } from "@/components/layout/NavItemLink";
import { SignOutButton } from "@/components/layout/SignOutButton";

type SidebarProps = {
  branding: OrganizationBranding;
  organizationId: string;
  user: CurrentUser;
  roleLabel?: string | null;
  className?: string;
};

export function Sidebar({
  branding,
  organizationId,
  user,
  roleLabel,
  className,
}: SidebarProps) {
  const pathname = usePathname();
  const items = getOrganizationNavItems(organizationId);

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
          {items.map((item) => (
            <li key={item.href}>
              <NavItemLink {...item} pathname={pathname} layout="sidebar" />
            </li>
          ))}
        </ul>
      </nav>
      <div className="space-y-3 border-t border-border px-4 py-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text-primary">
            {user.displayName ?? user.email ?? "Usuario"}
          </p>
          {roleLabel && (
            <p className="truncate text-xs text-text-secondary">{roleLabel}</p>
          )}
        </div>
        <SignOutButton />
      </div>
    </aside>
  );
}
