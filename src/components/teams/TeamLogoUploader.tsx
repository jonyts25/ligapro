"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setTeamLogoAction } from "@/lib/teams/actions";
import {
  TEAM_LOGO_BUCKET,
  TEAM_LOGO_MAX_BYTES,
  TEAM_LOGO_MIME_TYPES,
  extensionForTeamLogoMime,
} from "@/lib/teams/logo-constants";

type TeamLogoUploaderProps = {
  organizationId: string;
  teamId: string;
  currentLogoUrl: string | null;
  currentLogoPath: string | null;
};

export function TeamLogoUploader({
  organizationId,
  teamId,
  currentLogoUrl,
  currentLogoPath,
}: TeamLogoUploaderProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function removePreviousBestEffort(path: string | null) {
    if (!path) return;
    const supabase = createClient();
    await supabase.storage.from(TEAM_LOGO_BUCKET).remove([path]);
  }

  function onFileChange(file: File | null) {
    setError(null);
    if (!file) return;

    if (!(TEAM_LOGO_MIME_TYPES as readonly string[]).includes(file.type)) {
      setError("Solo se permiten imágenes PNG, JPEG o WebP.");
      return;
    }
    if (file.size > TEAM_LOGO_MAX_BYTES) {
      setError("El archivo supera el máximo de 2 MB.");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));

    startTransition(async () => {
      const ext = extensionForTeamLogoMime(file.type);
      if (!ext) {
        setError("Tipo de archivo no permitido.");
        return;
      }

      const logoPath = `${organizationId}/${teamId}/${crypto.randomUUID()}.${ext}`;
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(TEAM_LOGO_BUCKET)
        .upload(logoPath, file, {
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        setError("No pudimos subir el escudo. Inténtalo nuevamente.");
        return;
      }

      const result = await setTeamLogoAction({
        organizationId,
        teamId,
        logoPath,
      });

      if (!result.ok) {
        await supabase.storage.from(TEAM_LOGO_BUCKET).remove([logoPath]);
        setError(result.message ?? "No pudimos guardar el escudo.");
        return;
      }

      await removePreviousBestEffort(result.previousPath);
      router.refresh();
    });
  }

  function onRemoveLogo() {
    setError(null);
    startTransition(async () => {
      const result = await setTeamLogoAction({
        organizationId,
        teamId,
        logoPath: null,
      });
      if (!result.ok) {
        setError(result.message ?? "No pudimos quitar el escudo.");
        return;
      }
      await removePreviousBestEffort(result.previousPath ?? currentLogoPath);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface-elevated">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl ?? currentLogoUrl ?? undefined}
            alt=""
            className={
              previewUrl || currentLogoUrl
                ? "h-full w-full object-cover"
                : "hidden"
            }
          />
          {!previewUrl && !currentLogoUrl && (
            <span className="text-xs text-muted">Sin escudo</span>
          )}
        </div>
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface-elevated px-4 text-sm font-medium text-text-primary disabled:opacity-60"
          >
            {pending ? "Procesando…" : "Subir escudo"}
          </button>
          {(currentLogoUrl || currentLogoPath) && (
            <button
              type="button"
              disabled={pending}
              onClick={onRemoveLogo}
              className="ml-2 inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary disabled:opacity-60"
            >
              Quitar escudo
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted">PNG, JPEG o WebP · máximo 2 MB · sin SVG</p>
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
