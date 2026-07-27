"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import {
  fixtureToJsonPayload,
  generateRoundRobinFixture,
} from "@/lib/fixtures/round-robin";
import type { Json } from "@/types/database";
import type { GroupsActionState, GroupFixtureResult } from "@/lib/groups/types";

async function revalidateGroupsPaths(
  organizationId: string,
  competitionId: string,
  seasonId: string
) {
  const base = `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}`;
  revalidatePath(base);
  revalidatePath(`${base}/grupos`);
  revalidatePath(`${base}/bracket`);
  revalidatePath(`${base}/posiciones`);
  revalidatePath(`${base}/calendario`);
}

function humanizeGroupsError(message: string): string {
  return message || "No se pudo completar la operación.";
}

export async function setSeasonGroupsAction(
  _prev: GroupsActionState,
  formData: FormData
): Promise<GroupsActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const rawNames = String(formData.get("groupNames") ?? "");
  await requireOrganizationAdmin(user.id, organizationId);

  const names = rawNames
    .split("\n")
    .map((n) => n.trim())
    .filter(Boolean);

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_season_groups", {
    p_season_id: seasonId,
    p_group_names: names as unknown as Json,
  });

  if (error) {
    return { ok: false, message: humanizeGroupsError(error.message) };
  }

  await revalidateGroupsPaths(organizationId, competitionId, seasonId);
  return {
    ok: true,
    message: `Grupos actualizados (${names.length}). La lista anterior fue reemplazada.`,
  };
}

export async function assignTeamsToGroupsAction(
  _prev: GroupsActionState,
  formData: FormData
): Promise<GroupsActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  await requireOrganizationAdmin(user.id, organizationId);

  const assignmentsJson = String(formData.get("assignments") ?? "[]");
  let assignments: Array<{ season_team_id: string; group_id: string | null }>;
  try {
    assignments = JSON.parse(assignmentsJson);
  } catch {
    return { ok: false, message: "Asignaciones inválidas." };
  }

  const payload = assignments
    .filter((a) => a.group_id)
    .map((a) => ({
      season_team_id: a.season_team_id,
      group_id: a.group_id,
    }));

  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_teams_to_groups", {
    p_season_id: seasonId,
    p_assignments: payload as unknown as Json,
  });

  if (error) {
    return { ok: false, message: humanizeGroupsError(error.message) };
  }

  await revalidateGroupsPaths(organizationId, competitionId, seasonId);
  return { ok: true, message: "Equipos asignados a grupos." };
}

export async function createGroupFixturesAction(
  _prev: GroupsActionState,
  formData: FormData
): Promise<GroupsActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  await requireOrganizationAdmin(user.id, organizationId);

  const supabase = await createClient();

  const { data: season } = await supabase
    .from("seasons")
    .select("format_type")
    .eq("id", seasonId)
    .maybeSingle();

  const mode =
    season?.format_type === "round_robin_double" ? "double" : "single";

  const { data: groups } = await supabase
    .from("season_groups")
    .select("id, name")
    .eq("season_id", seasonId)
    .order("name");

  if (!groups?.length) {
    return { ok: false, message: "No hay grupos configurados." };
  }

  const results: GroupFixtureResult[] = [];

  for (const group of groups) {
    const { count: existing } = await supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("season_id", seasonId)
      .eq("season_group_id", group.id)
      .is("knockout_round_id", null);

    if ((existing ?? 0) > 0) {
      results.push({
        groupId: group.id,
        groupName: group.name,
        ok: false,
        message: "Ya tiene fixture",
      });
      continue;
    }

    const { data: teamRows } = await supabase
      .from("season_teams")
      .select("id, display_name, teams(name)")
      .eq("season_id", seasonId)
      .eq("season_group_id", group.id)
      .in("registration_status", ["registered", "confirmed"]);

    const eligible = (teamRows ?? []).map((st) => {
      const rel = st.teams as { name: string } | { name: string }[] | null;
      const base = Array.isArray(rel) ? rel[0]?.name : rel?.name;
      return {
        seasonTeamId: st.id,
        name: (st.display_name?.trim() || base || "Equipo").trim(),
      };
    });

    if (eligible.length < 2) {
      results.push({
        groupId: group.id,
        groupName: group.name,
        ok: false,
        message: "Menos de 2 equipos asignados",
      });
      continue;
    }

    try {
      const fixture = generateRoundRobinFixture(eligible, mode);
      const payload = fixtureToJsonPayload(fixture.matches);
      const { error } = await supabase.rpc(
        "create_season_round_robin_fixture",
        {
          p_season_id: seasonId,
          p_mode: mode,
          p_matches: payload as unknown as Json,
          p_group_id: group.id,
        }
      );

      if (error) {
        results.push({
          groupId: group.id,
          groupName: group.name,
          ok: false,
          message: error.message,
        });
      } else {
        results.push({
          groupId: group.id,
          groupName: group.name,
          ok: true,
          message: `${fixture.matches.length} partidos`,
        });
      }
    } catch (err) {
      results.push({
        groupId: group.id,
        groupName: group.name,
        ok: false,
        message: err instanceof Error ? err.message : "Error al calcular",
      });
    }
  }

  await revalidateGroupsPaths(organizationId, competitionId, seasonId);

  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.length - okCount;

  return {
    ok: okCount > 0 || failCount === 0,
    message:
      failCount === 0
        ? `Fixture generado para ${okCount} grupo(s).`
        : `${okCount} grupo(s) generados, ${failCount} omitidos o con error.`,
    details: results.map(
      (r) => `${r.groupName}: ${r.ok ? "OK" : "Error"} — ${r.message}`
    ),
  };
}
