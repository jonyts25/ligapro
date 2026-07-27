import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { isPlatformStaff } from "@/lib/platform-billing/queries";

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
