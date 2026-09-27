import NetInfo from "@react-native-community/netinfo";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { TeamBadge } from "@/components/capture/TeamBadge";
import { classifySyncError } from "@/lib/capture/network-error";
import { getSupabase } from "@/lib/supabase/client";
import {
  applyTeamStatDelta,
  buildSetMatchTeamStatsArgs,
  createDebouncedFlushScheduler,
  EMPTY_TEAM_STAT_COUNTS,
  syncStatusLabel,
  teamStatsFromRow,
  type TeamStatCounts,
  type TeamStatField,
  type TeamStatsSyncStatus,
} from "@/lib/stats/team-stats-sync";
import type { MatchRosterForCapture } from "@ligapro/shared";

type ScorekeeperStatsViewProps = {
  matchId: string;
  roster: MatchRosterForCapture;
};

type TeamSide = "home" | "away";

const STAT_FIELDS: Array<{ field: TeamStatField; label: string }> = [
  { field: "shots", label: "Tiros" },
  { field: "shotsOnTarget", label: "Tiros a gol" },
  { field: "corners", label: "Córners" },
  { field: "fouls", label: "Faltas" },
  { field: "offsides", label: "Fueras de lugar" },
];

function teamMeta(
  roster: MatchRosterForCapture,
  side: TeamSide
): {
  seasonTeamId: string;
  name: string;
  logoUrl: string | null;
} {
  if (side === "home") {
    return {
      seasonTeamId: roster.homeSeasonTeamId,
      name: roster.homeTeamName,
      logoUrl: roster.homeTeamLogoUrl,
    };
  }
  return {
    seasonTeamId: roster.awaySeasonTeamId,
    name: roster.awayTeamName,
    logoUrl: roster.awayTeamLogoUrl,
  };
}

function TeamCounterRow({
  label,
  value,
  onIncrement,
  onDecrement,
}: {
  label: string;
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  return (
    <View style={styles.counterRow}>
      <Text style={styles.counterLabel}>{label}</Text>
      <Text style={styles.counterValue}>{value}</Text>
      <View style={styles.counterActions}>
        <Pressable style={styles.plusButton} onPress={onIncrement}>
          <Text style={styles.plusButtonText}>+1</Text>
        </Pressable>
        <Pressable style={styles.minusButton} onPress={onDecrement}>
          <Text style={styles.minusButtonText}>-1</Text>
        </Pressable>
      </View>
    </View>
  );
}

function TeamStatsColumn({
  teamName,
  logoUrl,
  counts,
  syncStatus,
  onAdjust,
}: {
  teamName: string;
  logoUrl: string | null;
  counts: TeamStatCounts;
  syncStatus: TeamStatsSyncStatus;
  onAdjust: (field: TeamStatField, delta: 1 | -1) => void;
}) {
  return (
    <View style={styles.teamColumn}>
      <TeamBadge name={teamName} logoUrl={logoUrl} />
      {STAT_FIELDS.map(({ field, label }) => (
        <TeamCounterRow
          key={field}
          label={label}
          value={counts[field]}
          onIncrement={() => onAdjust(field, 1)}
          onDecrement={() => onAdjust(field, -1)}
        />
      ))}
      <Text
        style={[
          styles.syncStatus,
          syncStatus === "pending_network" && styles.syncStatusPending,
          syncStatus === "saving" && styles.syncStatusSaving,
        ]}
      >
        {syncStatusLabel(syncStatus)}
      </Text>
    </View>
  );
}

export function ScorekeeperStatsView({
  matchId,
  roster,
}: ScorekeeperStatsViewProps) {
  const [homeCounts, setHomeCounts] = useState<TeamStatCounts>({
    ...EMPTY_TEAM_STAT_COUNTS,
  });
  const [awayCounts, setAwayCounts] = useState<TeamStatCounts>({
    ...EMPTY_TEAM_STAT_COUNTS,
  });
  const [homeStatus, setHomeStatus] = useState<TeamStatsSyncStatus>("saved");
  const [awayStatus, setAwayStatus] = useState<TeamStatsSyncStatus>("saved");
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const homeCountsRef = useRef(homeCounts);
  const awayCountsRef = useRef(awayCounts);
  homeCountsRef.current = homeCounts;
  awayCountsRef.current = awayCounts;

  const teamIds = useMemo(
    () => ({
      home: roster.homeSeasonTeamId,
      away: roster.awaySeasonTeamId,
    }),
    [roster.homeSeasonTeamId, roster.awaySeasonTeamId]
  );

  const setStatusForTeam = useCallback(
    (seasonTeamId: string, status: TeamStatsSyncStatus) => {
      if (seasonTeamId === teamIds.home) setHomeStatus(status);
      if (seasonTeamId === teamIds.away) setAwayStatus(status);
    },
    [teamIds.home, teamIds.away]
  );

  const countsForTeam = useCallback(
    (seasonTeamId: string): TeamStatCounts => {
      if (seasonTeamId === teamIds.home) return homeCountsRef.current;
      if (seasonTeamId === teamIds.away) return awayCountsRef.current;
      return { ...EMPTY_TEAM_STAT_COUNTS };
    },
    [teamIds.home, teamIds.away]
  );

  const flushTeamStats = useCallback(
    async (seasonTeamId: string) => {
      const counts = countsForTeam(seasonTeamId);
      setStatusForTeam(seasonTeamId, "saving");

      try {
        const supabase = getSupabase();
        const { error: rpcError } = await supabase.rpc("set_match_team_stats", {
          ...buildSetMatchTeamStatsArgs({
            matchId,
            seasonTeamId,
            counts,
          }),
        });

        if (rpcError) {
          const outcome = classifySyncError(rpcError);
          if (outcome.kind === "network") {
            setStatusForTeam(seasonTeamId, "pending_network");
            return;
          }
          setError(outcome.message);
          setStatusForTeam(seasonTeamId, "saved");
          return;
        }

        setError(null);
        setStatusForTeam(seasonTeamId, "saved");
      } catch (err) {
        const outcome = classifySyncError(err);
        if (outcome.kind === "network") {
          setStatusForTeam(seasonTeamId, "pending_network");
          return;
        }
        setError(outcome.message);
        setStatusForTeam(seasonTeamId, "saved");
      }
    },
    [countsForTeam, matchId, setStatusForTeam]
  );

  const schedulerRef = useRef(
    createDebouncedFlushScheduler({
      onFlush: (teamId) => {
        void flushTeamStats(teamId);
      },
    })
  );

  useEffect(() => {
    return () => schedulerRef.current.cancelAll();
  }, []);

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { data, error: queryError } = await supabase
        .from("match_team_stats")
        .select(
          "season_team_id, shots, shots_on_target, corners, fouls, offsides"
        )
        .eq("match_id", matchId);

      if (queryError) throw queryError;

      const byTeam = new Map(
        (data ?? []).map((row) => [row.season_team_id, row])
      );

      setHomeCounts(teamStatsFromRow(byTeam.get(teamIds.home) ?? null));
      setAwayCounts(teamStatsFromRow(byTeam.get(teamIds.away) ?? null));
      setHomeStatus("saved");
      setAwayStatus("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar estadísticas");
    } finally {
      setLoadingStats(false);
    }
  }, [matchId, teamIds.home, teamIds.away]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const retryPendingTeams = useCallback(async () => {
    const pending: string[] = [];
    if (homeStatus === "pending_network") pending.push(teamIds.home);
    if (awayStatus === "pending_network") pending.push(teamIds.away);

    for (const teamId of pending) {
      await flushTeamStats(teamId);
    }
  }, [awayStatus, flushTeamStats, homeStatus, teamIds.away, teamIds.home]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        void retryPendingTeams();
      }
    });
    return unsubscribe;
  }, [retryPendingTeams]);

  function adjustTeam(side: TeamSide, field: TeamStatField, delta: 1 | -1) {
    const meta = teamMeta(roster, side);
    const setter = side === "home" ? setHomeCounts : setAwayCounts;

    setter((current) => applyTeamStatDelta(current, field, delta));
    setStatusForTeam(meta.seasonTeamId, "saving");
    schedulerRef.current.schedule(meta.seasonTeamId);
  }

  if (loadingStats) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  const home = teamMeta(roster, "home");
  const away = teamMeta(roster, "away");

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.matchTitle}>
        {roster.homeTeamName} vs {roster.awayTeamName}
      </Text>
      <Text style={styles.sectionHint}>
        Contadores por equipo. Los cambios se guardan automáticamente.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.columns}>
        <TeamStatsColumn
          teamName={home.name}
          logoUrl={home.logoUrl}
          counts={homeCounts}
          syncStatus={homeStatus}
          onAdjust={(field, delta) => adjustTeam("home", field, delta)}
        />
        <TeamStatsColumn
          teamName={away.name}
          logoUrl={away.logoUrl}
          counts={awayCounts}
          syncStatus={awayStatus}
          onAdjust={(field, delta) => adjustTeam("away", field, delta)}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  matchTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  sectionHint: {
    fontSize: 13,
    color: "#666",
  },
  error: {
    color: "#b42318",
    fontSize: 14,
  },
  columns: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  teamColumn: {
    flex: 1,
    minWidth: 0,
  },
  counterRow: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    gap: 6,
  },
  counterLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#444",
  },
  counterValue: {
    fontSize: 28,
    fontWeight: "700",
  },
  counterActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  plusButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  plusButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  minusButton: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  minusButtonText: {
    color: "#444",
    fontSize: 16,
    fontWeight: "600",
  },
  syncStatus: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "600",
    color: "#027a48",
  },
  syncStatusSaving: {
    color: "#444",
  },
  syncStatusPending: {
    color: "#b54708",
  },
});
