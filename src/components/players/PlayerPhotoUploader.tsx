"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setPlayerPhotoAction } from "@/lib/players/actions";
import {
  PLAYER_PHOTO_BUCKET,
  PLAYER_PHOTO_MAX_BYTES,
  PLAYER_PHOTO_MIME_TYPES,
  extensionForMime,
} from "@/lib/players/constants";

type PlayerPhotoUploaderProps = {
  organizationId: string;
  playerId: string;
  currentPhotoUrl: string | null;
  currentPhotoPath: string | null;
  revalidatePaths: string[];
};

export function PlayerPhotoUploader({
  organizationId,
  playerId,
  currentPhotoUrl,
  currentPhotoPath,
  revalidatePaths,
}: PlayerPhotoUploaderProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
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
    await supabase.storage.from(PLAYER_PHOTO_BUCKET).remove([path]);
  }

  function onFileChange(file: File | null) {
    setError(null);
    if (!file) return;

    if (!(PLAYER_PHOTO_MIME_TYPES as readonly string[]).includes(file.type)) {
      setError("Solo se permiten imágenes PNG, JPEG o WebP.");
      return;
    }
    if (file.size > PLAYER_PHOTO_MAX_BYTES) {
      setError("El archivo supera el máximo de 2 MB.");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));

    startTransition(async () => {
      const ext = extensionForMime(file.type);
      if (!ext) {
        setError("Tipo de archivo no permitido.");
        return;
      }

      const photoPath = `${organizationId}/${playerId}/${crypto.randomUUID()}.${ext}`;
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(PLAYER_PHOTO_BUCKET)
        .upload(photoPath, file, {
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        setError("No pudimos subir la foto. Inténtalo nuevamente.");
        return;
      }

      const result = await setPlayerPhotoAction({
        organizationId,
        playerId,
        photoPath,
        revalidatePaths,
      });

      if (!result.ok) {
        await supabase.storage.from(PLAYER_PHOTO_BUCKET).remove([photoPath]);
        setError(result.message ?? "No pudimos guardar la foto.");
        return;
      }

      await removePreviousBestEffort(result.previousPath);
      router.refresh();
    });
  }

  function onRemovePhoto() {
    setError(null);
    startTransition(async () => {
      const result = await setPlayerPhotoAction({
        organizationId,
        playerId,
        photoPath: null,
        revalidatePaths,
      });
      if (!result.ok) {
        setError(result.message ?? "No pudimos quitar la foto.");
        return;
      }
      await removePreviousBestEffort(result.previousPath ?? currentPhotoPath);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(e) => {
          onFileChange(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          onFileChange(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => cameraInputRef.current?.click()}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface-elevated px-4 text-sm font-medium disabled:opacity-60"
        >
          {pending ? "Procesando…" : "Tomar foto"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface-elevated px-4 text-sm font-medium disabled:opacity-60"
        >
          Subir de galería
        </button>
        {(currentPhotoUrl || currentPhotoPath) && (
          <button
            type="button"
            disabled={pending}
            onClick={onRemovePhoto}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary disabled:opacity-60"
          >
            Quitar foto
          </button>
        )}
      </div>
      <p className="text-xs text-muted">
        PNG, JPEG o WebP · máximo 2 MB · opcional
      </p>
      {(previewUrl || currentPhotoUrl) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl ?? currentPhotoUrl ?? undefined}
          alt=""
          className="h-24 w-24 rounded-2xl border border-border object-cover"
        />
      )}
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
