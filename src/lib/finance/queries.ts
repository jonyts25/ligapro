import { createClient } from "@/lib/supabase/server";
import { displaySeasonTeamName } from "@/lib/teams/types";
import {
  deriveFinanceTeamStatus,
  type FinanceChargeRow,
  type FinancePaymentRow,
  type SeasonFinanceTeamRow,
} from "@/lib/finance/types";

function seasonTeamDisplayName(row: {
  display_name: string | null;
  teams: { name: string } | { name: string }[] | null;
}): string {
  const rel = row.teams;
  const teamName = Array.isArray(rel) ? rel[0]?.name : rel?.name;
  return displaySeasonTeamName(row.display_name, teamName ?? "Equipo");
}

export async function getSeasonFinanceOverview(
  organizationId: string,
  seasonId: string
): Promise<SeasonFinanceTeamRow[]> {
  const supabase = await createClient();

  const { data: teams } = await supabase
    .from("season_teams")
    .select("id, display_name, registration_status, teams(name)")
    .eq("organization_id", organizationId)
    .eq("season_id", seasonId)
    .neq("registration_status", "withdrawn")
    .order("created_at");

  if (!teams?.length) return [];

  const seasonTeamIds = teams.map((t) => t.id);

  const [{ data: summaries }, { data: charges }, { data: payments }] =
    await Promise.all([
      supabase
        .from("season_team_financial_summary")
        .select(
          "season_team_id, total_active_charges, total_active_payments, balance_due, next_due_date"
        )
        .eq("organization_id", organizationId)
        .in("season_team_id", seasonTeamIds),
      supabase
        .from("team_charges")
        .select(
          "id, season_team_id, charge_type, description, amount, due_date, created_at"
        )
        .eq("organization_id", organizationId)
        .in("season_team_id", seasonTeamIds)
        .is("voided_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("team_payments")
        .select(
          "id, season_team_id, amount, payment_method, reference, notes, paid_at, created_at"
        )
        .eq("organization_id", organizationId)
        .in("season_team_id", seasonTeamIds)
        .is("voided_at", null)
        .order("paid_at", { ascending: false }),
    ]);

  const summaryByTeam = new Map(
    (summaries ?? []).map((s) => [s.season_team_id, s])
  );

  const chargesByTeam = new Map<string, FinanceChargeRow[]>();
  for (const row of charges ?? []) {
    const list = chargesByTeam.get(row.season_team_id) ?? [];
    list.push({
      id: row.id,
      seasonTeamId: row.season_team_id,
      chargeType: row.charge_type,
      description: row.description,
      amount: Number(row.amount),
      dueDate: row.due_date,
      createdAt: row.created_at,
    });
    chargesByTeam.set(row.season_team_id, list);
  }

  const paymentsByTeam = new Map<string, FinancePaymentRow[]>();
  for (const row of payments ?? []) {
    const list = paymentsByTeam.get(row.season_team_id) ?? [];
    list.push({
      id: row.id,
      seasonTeamId: row.season_team_id,
      amount: Number(row.amount),
      paymentMethod: row.payment_method,
      reference: row.reference,
      notes: row.notes,
      paidAt: row.paid_at,
      createdAt: row.created_at,
    });
    paymentsByTeam.set(row.season_team_id, list);
  }

  return teams.map((team) => {
    const summary = summaryByTeam.get(team.id);
    const totalCharges = Number(summary?.total_active_charges ?? 0);
    const totalPayments = Number(summary?.total_active_payments ?? 0);
    const balanceDue = Number(summary?.balance_due ?? 0);

    return {
      seasonTeamId: team.id,
      teamName: seasonTeamDisplayName(team),
      registrationStatus: team.registration_status,
      totalCharges,
      totalPayments,
      balanceDue,
      nextDueDate: summary?.next_due_date ?? null,
      status: deriveFinanceTeamStatus(totalCharges, balanceDue),
      charges: chargesByTeam.get(team.id) ?? [],
      payments: paymentsByTeam.get(team.id) ?? [],
    };
  });
}
