import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { isPlatformStaff } from "@/lib/platform-billing/queries";
import { PLATFORM_NAME } from "@/lib/platform/config";
import { cn } from "@/lib/utils/cn";

/** Banner on /seleccionar-organizacion (multi-org picker). */
export async function PlatformStaffLink() {
  const user = await requireUser();
  if (!(await isPlatformStaff(user.id))) {
    return null;
  }

  return (
    <p className="mb-4 text-sm text-text-secondary">
      Acceso interno {PLATFORM_NAME}:{" "}
      <Link
        href="/plataforma/facturacion"
        className="font-medium text-brand hover:underline"
      >
        Facturación
      </Link>
      {" · "}
      <Link
        href="/plataforma/cotizador"
        className="font-medium text-brand hover:underline"
      >
        Cotizador
      </Link>
      {" · "}
      <Link
        href="/plataforma/finanzas"
        className="font-medium text-brand hover:underline"
      >
        Finanzas
      </Link>
    </p>
  );
}

type PlatformStaffNavLinkProps = {
  className?: string;
};

/** Persistent nav entry in org AppShell — reachable with a single org membership. */
export async function PlatformStaffNavLink({
  className,
}: PlatformStaffNavLinkProps = {}) {
  const user = await requireUser();
  if (!(await isPlatformStaff(user.id))) {
    return null;
  }

  return (
    <div className={cn("space-y-1", className)}>
      <Link
        href="/plataforma/facturacion"
        className="inline-flex min-h-11 w-full items-center rounded-xl px-3 text-sm font-medium text-text-secondary hover:bg-surface-elevated hover:text-text-primary"
      >
        Facturación de plataforma
      </Link>
      <Link
        href="/plataforma/cotizador"
        className="inline-flex min-h-11 w-full items-center rounded-xl px-3 text-sm font-medium text-text-secondary hover:bg-surface-elevated hover:text-text-primary"
      >
        Cotizador interno
      </Link>
      <Link
        href="/plataforma/finanzas"
        className="inline-flex min-h-11 w-full items-center rounded-xl px-3 text-sm font-medium text-text-secondary hover:bg-surface-elevated hover:text-text-primary"
      >
        Finanzas internas
      </Link>
    </div>
  );
}
