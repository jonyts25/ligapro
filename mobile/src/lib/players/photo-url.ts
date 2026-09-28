import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@ligapro/database";

const PLAYER_PHOTO_BUCKET = "player-photos";
const SIGNED_URL_TTL_SECONDS = 3600;

export async function resolvePlayerPhotoUrl(
  supabase: SupabaseClient<Database>,
  playerId: string,
): Promise<string | null> {
  const { data: canView, error: gateError } = await supabase.rpc(
    "can_view_player_photo",
    { p_player_id: playerId },
  );

  if (gateError || !canView) {
    return null;
  }

  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("photo_path")
    .eq("id", playerId)
    .maybeSingle();

  if (playerError || !player?.photo_path) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from(PLAYER_PHOTO_BUCKET)
    .createSignedUrl(player.photo_path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}
