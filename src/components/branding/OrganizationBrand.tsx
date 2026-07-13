import Image from "next/image";
import type { OrganizationBranding } from "@/types/branding";
import { LIGAPRO_DEFAULT_BRANDING } from "@/lib/branding/defaults";
import { cn } from "@/lib/utils/cn";

type OrganizationBrandProps = {
  branding?: OrganizationBranding;
  variant?: "full" | "compact";
  className?: string;
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "LP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function OrganizationBrand({
  branding = LIGAPRO_DEFAULT_BRANDING,
  variant = "full",
  className,
}: OrganizationBrandProps) {
  const displayName =
    variant === "compact" && branding.shortName
      ? branding.shortName
      : branding.name;
  const initials = getInitials(branding.shortName ?? branding.name);
  const isLigaProFallback =
    !branding.logoUrl && branding.name === LIGAPRO_DEFAULT_BRANDING.name;

  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-elevated text-sm font-bold text-brand-foreground"
        style={{
          backgroundColor: isLigaProFallback
            ? "var(--brand)"
            : "var(--organization-accent)",
          color: "var(--brand-foreground)",
        }}
      >
        {branding.logoUrl ? (
          <Image
            src={branding.logoUrl}
            alt={`Logo de ${branding.name}`}
            width={40}
            height={40}
            className="h-full w-full object-cover"
          />
        ) : (
          <span aria-hidden="true">{initials}</span>
        )}
      </div>
      {variant === "full" && (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text-primary">
            {displayName}
          </p>
          {!isLigaProFallback && (
            <p className="truncate text-xs text-text-secondary">
              Operado con LigaPro
            </p>
          )}
        </div>
      )}
      {variant === "compact" && (
        <span className="sr-only">{displayName}</span>
      )}
    </div>
  );
}
