import { createClient } from "@/lib/supabase/server";
import {
  mapPresetRow,
  type TournamentTypePreset,
} from "@/lib/competitions/tournament-type-presets";

export async function getTournamentTypePresets(): Promise<TournamentTypePreset[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_tournament_type_presets");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapPresetRow);
}
