"use client";

import { useId, useState } from "react";
import { Menu } from "lucide-react";
import { OrganizationBrand } from "@/components/branding/OrganizationBrand";
import type { OrganizationBranding } from "@/types/branding";
import { cn } from "@/lib/utils/cn";
import { MobileMoreDrawer } from "@/components/layout/MobileMoreDrawer";

type TopBarProps = {
  branding: OrganizationBranding;
  title?: string;
  className?: string;
};

export function TopBar({ branding, title, className }: TopBarProps) {
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
        {title && (
          <p className="truncate text-sm font-medium text-text-primary">{title}</p>
        )}
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
      </header>
      <MobileMoreDrawer
        id={drawerId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </>
  );
}
