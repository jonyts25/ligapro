import type { CSSProperties, ReactNode } from "react";
import type { OrganizationBranding } from "@/types/branding";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { MobileNavigation } from "@/components/layout/MobileNavigation";
import { cn } from "@/lib/utils/cn";

type AppShellProps = {
  branding: OrganizationBranding;
  children: ReactNode;
  pageTitle?: string;
  className?: string;
};

export function AppShell({
  branding,
  children,
  pageTitle,
  className,
}: AppShellProps) {
  const accentStyle = branding.accentColor
    ? ({ "--organization-accent": branding.accentColor } as CSSProperties)
    : undefined;

  return (
    <div
      className="min-h-dvh bg-background text-text-primary"
      style={accentStyle}
    >
      <div className="mx-auto flex min-h-dvh max-w-[90rem]">
        <Sidebar branding={branding} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar branding={branding} title={pageTitle} />
          <main
            id="main-content"
            className={cn(
              "flex-1 px-4 py-5 pb-[calc(var(--nav-height)+1.25rem)] sm:px-6 sm:py-6 lg:pb-6",
              className
            )}
          >
            {children}
          </main>
        </div>
      </div>
      <MobileNavigation />
    </div>
  );
}
