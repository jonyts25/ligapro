import type { ReactNode } from "react";
import Link from "next/link";
import { OrganizationBrand } from "@/components/branding/OrganizationBrand";
import { PLATFORM_DEFAULT_BRANDING } from "@/lib/branding/defaults";
import { PLATFORM_NAME, PLATFORM_TAGLINE } from "@/lib/platform/config";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-text-primary">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-8 sm:px-6">
        <header className="mb-8">
          <Link href="/iniciar-sesion" className="inline-flex">
            <OrganizationBrand
              branding={PLATFORM_DEFAULT_BRANDING}
              variant="full"
            />
          </Link>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="mt-10 text-center text-xs text-muted">
          {PLATFORM_NAME} · {PLATFORM_TAGLINE}
        </footer>
      </div>
    </div>
  );
}
