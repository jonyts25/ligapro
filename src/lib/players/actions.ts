"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";

export async function setPlayerPhotoAction(input: {
  organizationId: string;
  playerId: string;
  photoPath: string | null;
  revalidatePaths?: string[];
}): Promise<{
  ok: boolean;
  message: string | null;
  previousPath: string | null;
}> {
  await requireUser();

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("players")
    .select("photo_path, organization_id")
    .eq("id", input.playerId)
    .maybeSingle();

  if (!current || current.organization_id !== input.organizationId) {
    return {
      ok: false,
      message: "Jugador no encontrado.",
      previousPath: null,
    };
  }

  const previousPath = current.photo_path ?? null;

  const { error } = await supabase.rpc("set_player_photo", {
    p_player_id: input.playerId,
    p_photo_path: input.photoPath as string,
  });

  if (error) {
    return {
      ok: false,
      message: "No pudimos actualizar la foto. Inténtalo nuevamente.",
      previousPath,
    };
  }

  for (const path of input.revalidatePaths ?? []) {
    revalidatePath(path);
  }

  return { ok: true, message: null, previousPath };
}
