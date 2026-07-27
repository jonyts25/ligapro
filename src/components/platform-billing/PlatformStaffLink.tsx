import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { isPlatformStaff } from "@/lib/platform-billing/queries";
import { cn } from "@/lib/utils/cn";

/** Banner on /seleccionar-organizacion (multi-org picker). */
export async function PlatformStaffLink() {
  const user = await requireUser();
  if (!(await isPlatformStaff(user.id))) {
    return null;
  }

  return (
    <p className="mb-4 text-sm text-text-secondary">
      Acceso interno LigaPro:{" "}
      <Link
        href="/plataforma/facturacion"
        className="font-medium text-brand hover:underline"
      >
        Facturación de plataforma
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
    <Link
      href="/plataforma/facturacion"
      className={cn(
        "inline-flex min-h-11 w-full items-center rounded-xl px-3 text-sm font-medium text-text-secondary hover:bg-surface-elevated hover:text-text-primary",
        className
      )}
    >
      Facturación de plataforma
    </Link>
  );
}
