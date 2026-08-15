"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PLATFORM_NAME } from "@/lib/platform/config";
import { cn } from "@/lib/utils/cn";

const LINKS = [
  { href: "/plataforma", label: "Inicio" },
  { href: "/plataforma/facturacion", label: "Facturación" },
  { href: "/plataforma/cotizador", label: "Cotizador" },
  { href: "/plataforma/finanzas", label: "Finanzas" },
  { href: "/plataforma/ventas", label: "Ventas" },
] as const;

export function PlatformPlataformaNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label={`Navegación interna ${PLATFORM_NAME}`}
      className="flex flex-wrap gap-2"
    >
      {LINKS.map(({ href, label }) => {
        const active =
          href === "/plataforma"
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "inline-flex min-h-11 items-center rounded-xl border px-3 text-sm font-medium",
              active
                ? "border-brand bg-brand text-brand-foreground"
                : "border-border text-text-secondary hover:bg-surface-elevated"
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
