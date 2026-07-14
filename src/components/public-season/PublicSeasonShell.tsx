import type { CSSProperties, ReactNode } from "react";
import { notFound } from "next/navigation";
import { getPublicSeasonOverview } from "@/lib/public-season/queries";
import { sanitizeAccentForCss } from "@/lib/branding/sanitize-accent";
import { PublicSeasonHeader } from "@/components/public-season/PublicSeasonHeader";
import { PublicSeasonNavigation } from "@/components/public-season/PublicSeasonNavigation";
import type { PublicSeasonTab } from "@/lib/public-season/types";

type PublicSeasonShellProps = {
  organizationId: string;
  seasonSlug: string;
  active: PublicSeasonTab;
  children: ReactNode;
};

export async function PublicSeasonShell({
  organizationId,
  seasonSlug,
  active,
  children,
}: PublicSeasonShellProps) {
  const overview = await getPublicSeasonOverview(organizationId, seasonSlug);
  if (!overview) notFound();

  const accent = sanitizeAccentForCss(overview.organizationBrandColor);
  const accentStyle = accent
    ? ({ "--organization-accent": accent } as CSSProperties)
    : undefined;

  return (
    <div
      className="min-h-dvh bg-background text-text-primary"
      style={accentStyle}
    >
      <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-6 sm:px-6">
        <PublicSeasonHeader overview={overview} />
        <div className="mt-4">
          <PublicSeasonNavigation
            organizationId={organizationId}
            seasonSlug={seasonSlug}
            active={active}
          />
        </div>
        <main id="main-content" className="mt-6 flex-1 space-y-8">
          {children}
        </main>
        <footer className="mt-10 border-t border-border pt-4 text-center text-xs text-muted">
          Gestionado con LigaPro
        </footer>
      </div>
    </div>
  );
}
