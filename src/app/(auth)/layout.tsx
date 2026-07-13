import type { ReactNode } from "react";
import Link from "next/link";
import { OrganizationBrand } from "@/components/branding/OrganizationBrand";
import { LIGAPRO_DEFAULT_BRANDING } from "@/lib/branding/defaults";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-text-primary">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-8 sm:px-6">
        <header className="mb-8">
          <Link href="/iniciar-sesion" className="inline-flex">
            <OrganizationBrand
              branding={LIGAPRO_DEFAULT_BRANDING}
              variant="full"
            />
          </Link>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="mt-10 text-center text-xs text-muted">
          LigaPro · Administración de ligas amateur
        </footer>
      </div>
    </div>
  );
}
