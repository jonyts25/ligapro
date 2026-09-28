import { Redirect, router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Button,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAuth } from "@/lib/auth/session";
import {
  matchOfficialRoleLabel,
  matchOfficialStatusLabel,
} from "@/lib/matches/labels";
import { getSupabase } from "@/lib/supabase/client";
import {
  fetchMyOfficialMatchAssignments,
  type MyOfficialMatchAssignmentCore,
} from "@ligapro/shared";

function formatMatchDate(iso: string | null): string {
  if (!iso) return "Sin fecha programada";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  }).format(new Date(iso));
}

function MatchRow({ item }: { item: MyOfficialMatchAssignmentCore }) {
  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/partidos/${item.matchId}`)}
    >
      <Text style={styles.matchTitle}>{item.matchupLabel}</Text>
      <Text style={styles.meta}>
        {item.competitionName} · {item.seasonName}
      </Text>
      <Text>{formatMatchDate(item.startsAt)}</Text>
      <Text>{item.venueFieldLabel}</Text>
      <Text>
        Rol: {matchOfficialRoleLabel(item.officialRole)} · Asignación:{" "}
        {matchOfficialStatusLabel(item.assignmentStatus)}
      </Text>
      <Text style={styles.openHint}>Toca para capturar</Text>
    </Pressable>
  );
}

export default function MisPartidosScreen() {
  const { user, loading, signOut } = useAuth();
  const [items, setItems] = useState<MyOfficialMatchAssignmentCore[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const loadMatches = useCallback(async () => {
    if (!user) return;

    try {
      const supabase = getSupabase();
      const data = await fetchMyOfficialMatchAssignments(supabase, user.id);
      setItems(data);
      setFetchError(null);
    } catch (error) {
      setFetchError(
        error instanceof Error ? error.message : "Error al cargar partidos",
      );
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setInitialLoading(false);
      return;
    }

    loadMatches().finally(() => setInitialLoading(false));
  }, [user, loadMatches]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadMatches();
    setRefreshing(false);
  }

  if (!loading && !user) {
    return <Redirect href="/login" />;
  }

  if (loading || initialLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.headerActions}>
          <Button
            title="Cuenta"
            onPress={() => router.push("/eliminar-cuenta")}
          />
          <Button title="Salir" onPress={() => signOut()} />
        </View>
      </View>

      {fetchError ? <Text style={styles.error}>{fetchError}</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item.matchOfficialId}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            No tienes partidos asignados como oficial.
          </Text>
        }
        renderItem={({ item }) => <MatchRow item={item} />}
        contentContainerStyle={items.length ? styles.list : styles.listEmpty}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    gap: 12,
  },
  email: {
    flex: 1,
    fontSize: 14,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 16,
  },
  card: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    gap: 4,
  },
  matchTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  meta: {
    fontSize: 13,
    color: "#666",
  },
  openHint: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
    color: "#111",
  },
  empty: {
    textAlign: "center",
    color: "#666",
  },
  error: {
    color: "#b42318",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
});
