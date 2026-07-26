"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import {
  humanizeSeasonFieldBlocksError,
  type SeasonFieldBlocksActionState,
} from "@/lib/season-fields/types";
import { validateAvailabilityIntervals } from "@/lib/venues/availability-validation";

type BlockInput = {
  field_id: string;
  day_of_week: number;
  starts_at: string;
  ends_at: string;
};

export async function setSeasonFieldBlocksAction(input: {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  blocks: BlockInput[];
}): Promise<SeasonFieldBlocksActionState> {
  const user = await requireUser();
  await requireOrganizationAdmin(user.id, input.organizationId);

  for (const block of input.blocks) {
    const validationError = validateAvailabilityIntervals([
      {
        day_of_week: block.day_of_week,
        starts_at: block.starts_at,
        ends_at: block.ends_at,
      },
    ]);
    if (validationError) {
      return { ok: false, message: validationError };
    }
    if (!block.field_id) {
      return { ok: false, message: "Selecciona una cancha para cada bloqueo." };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_season_field_blocks", {
    p_season_id: input.seasonId,
    p_blocks: input.blocks,
  });

  if (error) {
    return {
      ok: false,
      message: humanizeSeasonFieldBlocksError(error.message),
    };
  }

  const base = `/organizaciones/${input.organizationId}/torneos/${input.competitionId}/temporadas/${input.seasonId}`;
  revalidatePath(`${base}/canchas`);
  revalidatePath(`/organizaciones/${input.organizationId}/sedes/disponibilidad`);

  return { ok: true, message: "Bloqueos de cancha guardados." };
}
