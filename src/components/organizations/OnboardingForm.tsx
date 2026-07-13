"use client";

import { useActionState, useMemo, useState, type CSSProperties } from "react";
import {
  createOrganizationAction,
} from "@/lib/organizations/actions";
import { initialOrganizationActionState } from "@/lib/organizations/action-state";
import { BRAND_COLOR_PRESETS } from "@/lib/organizations/branding-constants";
import { normalizeAccentColor } from "@/lib/branding/sanitize-accent";
import { OrganizationBrand } from "@/components/branding/OrganizationBrand";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";

type OnboardingFormProps = {
  userLabel: string;
};

export function OnboardingForm({ userLabel }: OnboardingFormProps) {
  const [state, formAction, pending] = useActionState(
    createOrganizationAction,
    initialOrganizationActionState
  );
  const [name, setName] = useState(state.values?.name ?? "");
  const [brandColor, setBrandColor] = useState(
    state.values?.brandColor ?? "#14B8A6"
  );
  const [useDefaultColor, setUseDefaultColor] = useState(false);

  const previewAccent = useMemo(() => {
    if (useDefaultColor) return null;
    return normalizeAccentColor(brandColor);
  }, [brandColor, useDefaultColor]);

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <p className="text-sm text-text-secondary">
          Sesión iniciada como{" "}
          <span className="font-medium text-text-primary">{userLabel}</span>.
        </p>
        <p className="text-sm text-text-secondary">
          Configura el espacio desde el que administrarás tus ligas y torneos.
          Después podrás registrar tus canchas y campos.
        </p>
        <p className="text-xs text-muted">
          La organización puede ser tu complejo deportivo, liga o empresa
          organizadora. Las canchas se registran en el siguiente paso.
        </p>
      </Card>

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
              name: name.trim() || "Tu organización",
              shortName: name.trim() || "ORG",
              logoUrl: null,
              accentColor: previewAccent,
            }}
            variant="full"
          />
        </div>
      </Card>

      <Card>
        {state.message && !state.ok && (
          <p
            className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
            role="alert"
          >
            {state.message}
          </p>
        )}

        <form action={formAction} className="space-y-5">
          <div className="space-y-1.5">
            <label
              htmlFor="name"
              className="block text-sm font-medium text-text-primary"
            >
              Nombre de la organización o complejo deportivo
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
              autoComplete="organization"
              className={cn(
                "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-text-primary outline-none",
                "focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                state.fieldErrors?.name && "border-danger"
              )}
            />
            {state.fieldErrors?.name && (
              <p className="text-xs text-danger" role="alert">
                {state.fieldErrors.name}
              </p>
            )}
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
                      disabled={pending}
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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="brandColorPicker"
                      className="block text-sm font-medium text-text-primary"
                    >
                      Selector
                    </label>
                    <input
                      id="brandColorPicker"
                      type="color"
                      value={
                        normalizeAccentColor(brandColor)?.toLowerCase() ??
                        "#14b8a6"
                      }
                      onChange={(e) =>
                        setBrandColor(e.target.value.toUpperCase())
                      }
                      disabled={pending}
                      className="h-11 w-16 cursor-pointer rounded-lg border border-border bg-background"
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <label
                      htmlFor="brandColorHex"
                      className="block text-sm font-medium text-text-primary"
                    >
                      Hexadecimal
                    </label>
                    <input
                      id="brandColorHex"
                      value={brandColor}
                      onChange={(e) => setBrandColor(e.target.value.toUpperCase())}
                      disabled={pending}
                      className={cn(
                        "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-text-primary outline-none",
                        "focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                        state.fieldErrors?.brandColor && "border-danger"
                      )}
                    />
                    {state.fieldErrors?.brandColor && (
                      <p className="text-xs text-danger" role="alert">
                        {state.fieldErrors.brandColor}
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted">
                  El acento no reemplaza danger, warning, success ni los
                  colores de tarjetas deportivas.
                </p>
              </>
            )}
          </fieldset>

          <SubmitButton pending={pending}>Crear organización</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
