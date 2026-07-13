"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { getMobileMoreNavItems } from "@/components/layout/nav-items";
import { NavItemLink } from "@/components/layout/NavItemLink";
import { usePathname } from "next/navigation";

type MobileMoreDrawerProps = {
  id: string;
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManageSettings?: boolean;
};

export function MobileMoreDrawer({
  id,
  organizationId,
  open,
  onOpenChange,
  canManageSettings = false,
}: MobileMoreDrawerProps) {
  const pathname = usePathname();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const items = getMobileMoreNavItems(organizationId, { canManageSettings });

  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      previouslyFocusedRef.current?.focus();
    };
  }, [open, onOpenChange]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 lg:hidden",
        !open && "pointer-events-none invisible"
      )}
      role="presentation"
      aria-hidden={!open}
    >
      <button
        type="button"
        tabIndex={open ? 0 : -1}
        className={cn(
          "absolute inset-0 bg-background/70 backdrop-blur-sm",
          !open && "hidden"
        )}
        aria-label="Cerrar menú"
        onClick={() => onOpenChange(false)}
      />
      <div
        id={id}
        role="dialog"
        aria-modal={open}
        aria-hidden={!open}
        aria-labelledby={`${id}-title`}
        className={cn(
          "absolute inset-x-0 bottom-[calc(var(--nav-height)+env(safe-area-inset-bottom,0px))] mx-3 rounded-2xl border border-border bg-surface shadow-xl",
          "max-h-[min(24rem,calc(100dvh-var(--nav-height)-5rem))] overflow-y-auto",
          !open && "hidden"
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2
            id={`${id}-title`}
            className="text-sm font-semibold text-text-primary"
          >
            Más módulos
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            tabIndex={open ? 0 : -1}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-surface-elevated text-text-secondary hover:text-text-primary"
            aria-label="Cerrar menú de módulos"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <nav aria-label="Módulos adicionales" className="px-3 py-3">
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.href}>
                <NavItemLink
                  {...item}
                  pathname={pathname}
                  layout="drawer"
                  onNavigate={() => onOpenChange(false)}
                />
              </li>
            ))}
          </ul>
        </nav>
        <p className="border-t border-border px-4 py-3 text-xs text-muted">
          Estos módulos estarán disponibles en fases posteriores del frontend.
        </p>
      </div>
    </div>
  );
}
