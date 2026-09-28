import { Redirect, router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAuth } from "@/lib/auth/session";
import { resolveOwnPlayerPhotoUrl } from "@/lib/players/photo-url";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  fetchMyPlayerStats,
  getPersonContexts,
  sumPlayerStatsTotals,
  type PersonPlayerTeam,
  type PlayerStatsRow,
  type PlayerStatsTotals,
} from "@ligapro/shared";

function playerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

function StatsCard({
  title,
  stats,
}: {
  title: string;
  stats: PlayerStatsTotals;
}) {
  const items = [
    { label: "Partidos jugados", value: stats.matchesPlayed },
    { label: "Goles", value: stats.goals },
    { label: "Asistencias", value: stats.assists },
    { label: "Autogoles", value: stats.ownGoals },
    { label: "Amarillas", value: stats.yellowCards },
    { label: "Rojas", value: stats.redCards },
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={styles.statsGrid}>
        {items.map((item) => (
          <View key={item.label} style={styles.statCell}>
            <Text style={styles.statValue}>{item.value}</Text>
            <Text style={styles.statLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function PlayerProfileScreen() {
  const { session, user, loading } = useAuth();
  const [teams, setTeams] = useState<PersonPlayerTeam[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [statsRows, setStatsRows] = useState<PlayerStatsRow[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.seasonTeamPlayerId === selectedTeamId) ?? null,
    [teams, selectedTeamId],
  );

  const selectedStats = useMemo(() => {
    if (!selectedTeamId) return null;
    return (
      statsRows.find((row) => row.seasonTeamPlayerId === selectedTeamId) ?? {
        seasonTeamPlayerId: selectedTeamId,
        matchesPlayed: 0,
        goals: 0,
        assists: 0,
        ownGoals: 0,
        yellowCards: 0,
        redCards: 0,
      }
    );
  }, [statsRows, selectedTeamId]);

  const totalStats = useMemo(() => sumPlayerStatsTotals(statsRows), [statsRows]);

  const loadProfile = useCallback(async () => {
    if (!user) return;

    try {
      const supabase = getSupabase();
      const contexts = await getPersonContexts(supabase, user.id);
      const playerTeams = contexts.equiposComoJugador;

      if (playerTeams.length === 0) {
        setTeams([]);
        setSelectedTeamId(null);
        setStatsRows([]);
        setFetchError(null);
        return;
      }

      setTeams(playerTeams);
      setSelectedTeamId((current) => {
        if (current && playerTeams.some((team) => team.seasonTeamPlayerId === current)) {
          return current;
        }
        return playerTeams[0]!.seasonTeamPlayerId;
      });

      const stats = await fetchMyPlayerStats(
        supabase,
        playerTeams.map((team) => team.seasonTeamPlayerId),
      );
      setStatsRows(stats);
      setFetchError(null);
    } catch (error) {
      setFetchError(
        error instanceof Error ? error.message : "Error al cargar tu perfil",
      );
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setInitialLoading(false);
      return;
    }

    loadProfile().finally(() => setInitialLoading(false));
  }, [user, loadProfile]);

  useEffect(() => {
    if (!user || !selectedTeam) return;

    let cancelled = false;

    async function loadTeamPlayerDetails() {
      const supabase = getSupabase();
      const [{ data: profile }, { data: player }] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
        supabase
          .from("players")
          .select("full_name, photo_path")
          .eq("id", selectedTeam!.playerId)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      const name =
        player?.full_name?.trim() ||
        profile?.display_name?.trim() ||
        user.email?.split("@")[0] ||
        "Jugador";
      setDisplayName(name);

      const signedUrl = await resolveOwnPlayerPhotoUrl(supabase, selectedTeam!.playerId);
      if (!cancelled) {
        setPhotoUrl(signedUrl);
      }
    }

    void loadTeamPlayerDetails();

    return () => {
      cancelled = true;
    };
  }, [selectedTeam, user]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  }

  if (!isSupabaseConfigured()) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>
          Copia mobile/.env.example a mobile/.env con las credenciales de ligapro-dev.
        </Text>
      </View>
    );
  }

  if (!loading && !session) {
    return <Redirect href="/login" />;
  }

  if (loading || initialLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (teams.length === 0) {
    return <Redirect href="/" />;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <Pressable onPress={() => router.back()} style={styles.backLink}>
        <Text style={styles.backLinkText}>← Volver al inicio</Text>
      </Pressable>

      <View style={styles.header}>
        <View style={styles.avatar}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarInitials}>{playerInitials(displayName)}</Text>
          )}
        </View>
        <Text style={styles.name}>{displayName}</Text>
        {selectedTeam ? (
          <Text style={styles.subtitle}>
            {selectedTeam.teamName} · {selectedTeam.seasonName}
          </Text>
        ) : null}
      </View>

      {fetchError ? <Text style={styles.error}>{fetchError}</Text> : null}

      {teams.length > 1 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Equipo</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.teamTabs}>
              {teams.map((team) => {
                const selected = team.seasonTeamPlayerId === selectedTeamId;
                return (
                  <Pressable
                    key={team.seasonTeamPlayerId}
                    style={[styles.teamTab, selected && styles.teamTabSelected]}
                    onPress={() => setSelectedTeamId(team.seasonTeamPlayerId)}
                  >
                    <Text
                      style={[
                        styles.teamTabText,
                        selected && styles.teamTabTextSelected,
                      ]}
                    >
                      {team.teamName}
                    </Text>
                    <Text style={styles.teamTabMeta}>{team.competitionName}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      ) : null}

      {selectedStats ? (
        <StatsCard
          title={
            teams.length > 1
              ? `Estadísticas · ${selectedTeam?.teamName ?? "equipo"}`
              : "Estadísticas"
          }
          stats={selectedStats}
        />
      ) : null}

      <StatsCard title="Total en todos tus equipos" stats={totalStats} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 20,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  backLink: {
    alignSelf: "flex-start",
  },
  backLinkText: {
    fontSize: 14,
    color: "#175cd3",
    fontWeight: "600",
  },
  header: {
    alignItems: "center",
    gap: 8,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: "hidden",
    backgroundColor: "#eee",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarInitials: {
    fontSize: 28,
    fontWeight: "700",
    color: "#555",
  },
  name: {
    fontSize: 24,
    fontWeight: "600",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  teamTabs: {
    flexDirection: "row",
    gap: 8,
  },
  teamTab: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 140,
    backgroundColor: "#fff",
  },
  teamTabSelected: {
    borderColor: "#111",
    backgroundColor: "#f5f5f5",
  },
  teamTabText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  teamTabTextSelected: {
    color: "#111",
  },
  teamTabMeta: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  card: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCell: {
    width: "30%",
    minWidth: 96,
    gap: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
  },
  error: {
    color: "#b42318",
    textAlign: "center",
  },
});
