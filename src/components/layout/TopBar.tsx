"use client";

import { useId, useState } from "react";
import { Menu } from "lucide-react";
import { OrganizationBrand } from "@/components/branding/OrganizationBrand";
import type { OrganizationBranding } from "@/types/branding";
import type { CurrentUser } from "@/lib/auth/types";
import { cn } from "@/lib/utils/cn";
import { MobileMoreDrawer } from "@/components/layout/MobileMoreDrawer";
import { SignOutButton } from "@/components/layout/SignOutButton";

type TopBarProps = {
  branding: OrganizationBranding;
  organizationId: string;
  user: CurrentUser;
  roleLabel?: string | null;
  title?: string;
  canManageSettings?: boolean;
  className?: string;
};

export function TopBar({
  branding,
  organizationId,
  user,
  roleLabel,
  title,
  canManageSettings = false,
  className,
}: TopBarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerId = useId();

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-30 flex min-h-14 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/90 lg:hidden",
          className
        )}
      >
        <OrganizationBrand branding={branding} variant="compact" />
        <div className="min-w-0 flex-1">
          {title && (
            <p className="truncate text-sm font-medium text-text-primary">
              {title}
            </p>
          )}
          <p className="truncate text-xs text-text-secondary">
            {user.displayName ?? user.email}
            {roleLabel ? ` · ${roleLabel}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SignOutButton compact />
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-surface text-text-secondary hover:text-text-primary"
            aria-label="Abrir menú de módulos adicionales"
            aria-expanded={drawerOpen}
            aria-controls={drawerId}
            onClick={() => setDrawerOpen(true)}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </header>
      <MobileMoreDrawer
        id={drawerId}
        organizationId={organizationId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        canManageSettings={canManageSettings}
      />
    </>
  );
}
