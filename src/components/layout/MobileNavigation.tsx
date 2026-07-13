"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import {
  getMobilePrimaryNavItems,
  isActiveRoute,
} from "@/components/layout/nav-items";

type MobileNavigationProps = {
  organizationId: string;
  canManageSettings?: boolean;
};

export function MobileNavigation({
  organizationId,
  canManageSettings = false,
}: MobileNavigationProps) {
  const pathname = usePathname();
  const primaryItems = getMobilePrimaryNavItems(organizationId, {
    canManageSettings,
  });

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/90 lg:hidden"
      aria-label="Navegación móvil"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="grid grid-cols-5">
        {primaryItems.map(({ href, label, icon: Icon, available }) => {
          const active = available && isActiveRoute(pathname, href);

          if (!available) {
            return (
              <li key={href}>
                <span
                  aria-disabled="true"
                  title="Próximamente"
                  className="flex min-h-[var(--nav-height)] flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-medium text-muted opacity-70 sm:text-xs"
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span className="truncate">{label}</span>
                  <span className="sr-only">Próximamente</span>
                </span>
              </li>
            );
          }

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[var(--nav-height)] flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-medium sm:text-xs",
                  active
                    ? "text-organization-accent"
                    : "text-text-secondary hover:text-text-primary"
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
