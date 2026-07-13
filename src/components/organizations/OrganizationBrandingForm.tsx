"use client";

import { useActionState, useMemo, useState, type CSSProperties } from "react";
import {
  updateOrganizationBrandingAction,
} from "@/lib/organizations/actions";
import { initialOrganizationActionState } from "@/lib/organizations/action-state";
import { BRAND_COLOR_PRESETS } from "@/lib/organizations/branding-constants";
import { normalizeAccentColor } from "@/lib/branding/sanitize-accent";
import { OrganizationBrand } from "@/components/branding/OrganizationBrand";
import { OrganizationLogoUploader } from "@/components/organizations/OrganizationLogoUploader";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import type { OrganizationBranding } from "@/types/branding";

type OrganizationBrandingFormProps = {
  organizationId: string;
  initialName: string;
  initialBrandColor: string | null;
  branding: OrganizationBranding;
  logoPath: string | null;
  setup?: boolean;
};

export function OrganizationBrandingForm({
  organizationId,
  initialName,
  initialBrandColor,
  branding,
  logoPath,
  setup,
}: OrganizationBrandingFormProps) {
  const [state, formAction, pending] = useActionState(
    updateOrganizationBrandingAction,
    initialOrganizationActionState
  );
  const [name, setName] = useState(initialName);
  const [brandColor, setBrandColor] = useState(initialBrandColor ?? "#14B8A6");
  const [useDefaultColor, setUseDefaultColor] = useState(!initialBrandColor);

  const previewAccent = useMemo(() => {
    if (useDefaultColor) return null;
    return normalizeAccentColor(brandColor);
  }, [brandColor, useDefaultColor]);

  return (
    <div className="space-y-6">
      <Card>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
          Vista previa
        </p>
        <div
          style={
            previewAccent
              ? ({ "--organization-accent": previewAccent } as CSSProperties)
              : undefined
          }
        >
          <OrganizationBrand
            branding={{
              ...branding,
              name: name.trim() || branding.name,
              accentColor: previewAccent,
            }}
            variant="full"
          />
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Logo</h2>
        <OrganizationLogoUploader
          organizationId={organizationId}
          currentLogoUrl={branding.logoUrl ?? null}
          currentLogoPath={logoPath}
        />
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-text-primary">
          Identidad de la organización
        </h2>
        {state.message && (
          <p
            className={`mb-4 rounded-xl border px-3 py-2 text-sm ${
              state.ok
                ? "border-success/40 bg-success/10 text-success"
                : "border-danger/40 bg-danger/10 text-danger"
            }`}
            role={state.ok ? "status" : "alert"}
          >
            {state.message}
          </p>
        )}

        <form action={formAction} className="space-y-5">
          <input type="hidden" name="organizationId" value={organizationId} />
          <div className="space-y-1.5">
            <label
              htmlFor="name"
              className="block text-sm font-medium text-text-primary"
            >
              Nombre
            </label>
            <input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={3}
              maxLength={100}
              disabled={pending}
              className={cn(
                "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-text-primary outline-none",
                "focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              )}
            />
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-text-primary">
              Color de acento
            </legend>
            <label className="flex items-center gap-3 text-sm text-text-secondary">
              <input
                type="checkbox"
                name="useDefaultColor"
                checked={useDefaultColor}
                onChange={(e) => setUseDefaultColor(e.target.checked)}
                disabled={pending}
              />
              Usar color LigaPro
            </label>
            {!useDefaultColor && (
              <>
                <input type="hidden" name="brandColor" value={brandColor} />
                <div className="flex flex-wrap gap-2">
                  {BRAND_COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      aria-label={`Usar color ${preset}`}
                      onClick={() => setBrandColor(preset)}
                      className={cn(
                        "h-10 w-10 rounded-xl border border-border",
                        brandColor.toUpperCase() === preset &&
                          "ring-2 ring-[var(--focus-ring)]"
                      )}
                      style={{ backgroundColor: preset }}
                    />
                  ))}
                </div>
                <div className="flex gap-3">
                  <input
                    type="color"
                    value={
                      normalizeAccentColor(brandColor)?.toLowerCase() ??
                      "#14b8a6"
                    }
                    onChange={(e) => setBrandColor(e.target.value.toUpperCase())}
                    className="h-11 w-16 rounded-lg border border-border bg-background"
                  />
                  <input
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value.toUpperCase())}
                    className="min-h-11 flex-1 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
              </>
            )}
          </fieldset>

          <SubmitButton pending={pending}>Guardar identidad</SubmitButton>
        </form>
      </Card>

      {setup && (
        <a
          href={`/organizaciones/${organizationId}/inicio`}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
        >
          Ir al inicio
        </a>
      )}
    </div>
  );
}
