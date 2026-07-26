import { createClient } from "@/lib/supabase/server";
import { PLAYER_PHOTO_BUCKET } from "@/lib/players/constants";

const SIGNED_URL_TTL_SECONDS = 3600;

export async function resolvePlayerPhotoUrl(
  photoPath: string | null | undefined
): Promise<string | null> {
  if (!photoPath) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(PLAYER_PHOTO_BUCKET)
    .createSignedUrl(photoPath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function resolvePlayerPhotoUrlMap(
  photoPaths: Array<string | null | undefined>
): Promise<Map<string, string>> {
  const unique = [
    ...new Set(photoPaths.filter((p): p is string => Boolean(p))),
  ];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;

  const supabase = await createClient();
  await Promise.all(
    unique.map(async (path) => {
      const { data } = await supabase.storage
        .from(PLAYER_PHOTO_BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      if (data?.signedUrl) map.set(path, data.signedUrl);
    })
  );

  return map;
}
