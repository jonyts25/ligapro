import { Redirect, router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Button,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  buildAdminOrganizationUrl,
  buildPublicSeasonUrl,
} from "@/lib/person/site-urls";
import { useAuth } from "@/lib/auth/session";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  getPersonContexts,
  type PersonContexts,
} from "@ligapro/shared/person-contexts";
import {
  matchOfficialRoleLabel,
  matchOfficialStatusLabel,
} from "@/lib/matches/labels";

function formatMatchDate(iso: string | null): string {
  if (!iso) return "Sin fecha programada";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  }).format(new Date(iso));
}

async function openWebUrl(url: string): Promise<void> {
  await WebBrowser.openBrowserAsync(url);
}

export default function PersonHomeScreen() {
  const { session, user, loading, signOut } = useAuth();
  const [contexts, setContexts] = useState<PersonContexts | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const loadContexts = useCallback(async () => {
    if (!user) return;

    try {
      const supabase = getSupabase();
      const data = await getPersonContexts(supabase, user.id);
      setContexts(data);
      setFetchError(null);
    } catch (error) {
      setFetchError(
        error instanceof Error ? error.message : "Error al cargar tu actividad",
      );
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setInitialLoading(false);
      return;
    }

    loadContexts().finally(() => setInitialLoading(false));
  }, [user, loadContexts]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadContexts();
    setRefreshing(false);
  }

  if (!isSupabaseConfigured()) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>
          Copia mobile/.env.example a mobile/.env con las credenciales de
          ligapro-dev.
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

  const adminOrgs = contexts?.organizacionesAdmin ?? [];
  const officialMatches = contexts?.partidosPorArbitrar ?? [];
  const playerTeams = contexts?.equiposComoJugador ?? [];
  const isEmpty =
    adminOrgs.length === 0 &&
    officialMatches.length === 0 &&
    playerTeams.length === 0;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Ligera</Text>
          <Text style={styles.subtitle}>{user?.email}</Text>
        </View>
        <View style={styles.headerActions}>
          <Button
            title="Cuenta"
            onPress={() => router.push("/eliminar-cuenta")}
          />
          <Button title="Salir" onPress={() => signOut()} />
        </View>
      </View>

      {fetchError ? <Text style={styles.error}>{fetchError}</Text> : null}

      {isEmpty ? (
        <Text style={styles.empty}>
          Aún no tienes actividad — cuando te inviten a un equipo o te asignen
          un partido, aparecerá aquí.
        </Text>
      ) : null}

      {adminOrgs.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Administras</Text>
          {adminOrgs.map((org) => (
            <View key={org.id} style={styles.card}>
              <Text style={styles.cardTitle}>{org.name}</Text>
              <Button
                title="Abrir panel web"
                onPress={() => void openWebUrl(buildAdminOrganizationUrl(org.id))}
              />
            </View>
          ))}
        </View>
      ) : null}

      {officialMatches.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Por arbitrar / anotar</Text>
          <Text style={styles.sectionHint}>
            Toca un partido para ir a captura nativa, o abre la lista completa.
          </Text>
          {officialMatches.slice(0, 5).map((match) => (
            <Pressable
              key={match.matchOfficialId}
              style={styles.card}
              onPress={() => router.push(`/partidos/${match.matchId}`)}
            >
              <Text style={styles.cardTitle}>{match.matchupLabel}</Text>
              <Text style={styles.meta}>
                {match.competitionName} · {match.seasonName}
              </Text>
              <Text style={styles.meta}>{formatMatchDate(match.startsAt)}</Text>
              <Text style={styles.meta}>
                {matchOfficialRoleLabel(match.officialRole)} ·{" "}
                {matchOfficialStatusLabel(match.assignmentStatus)}
              </Text>
            </Pressable>
          ))}
          <Button
            title="Ver todos mis partidos"
            onPress={() => router.push("/mis-partidos")}
          />
        </View>
      ) : null}

      {playerTeams.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tus equipos</Text>
          <Pressable
            style={styles.profileCard}
            onPress={() => router.push("/perfil")}
          >
            <Text style={styles.profileCardTitle}>Mi perfil</Text>
            <Text style={styles.profileCardHint}>
              Estadísticas de partidos, goles y tarjetas por equipo.
            </Text>
          </Pressable>
          {playerTeams.map((team) => {
            const isLeader = team.isCaptain || team.isViceCaptain;
            const webUrl = buildPublicSeasonUrl(
              team.organizationId,
              team.seasonSlug,
            );

            return (
              <View key={team.seasonTeamPlayerId} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{team.teamName}</Text>
                  {team.isCaptain ? (
                    <Text style={styles.badge}>Capitán</Text>
                  ) : team.isViceCaptain ? (
                    <Text style={styles.badge}>Subcapitán</Text>
                  ) : null}
                </View>
                <Text style={styles.meta}>
                  {team.competitionName} · {team.seasonName}
                </Text>
                <Text style={styles.meta}>{team.organizationName}</Text>
                {isLeader ? (
                  <Button
                    title="Gestionar mi equipo"
                    onPress={() =>
                      router.push(`/mi-equipo/${team.seasonTeamId}`)
                    }
                  />
                ) : (
                  <Button
                    title="Ver temporada pública"
                    onPress={() => void openWebUrl(webUrl)}
                  />
                )}
              </View>
            );
          })}
        </View>
      ) : null}
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
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  sectionHint: {
    fontSize: 13,
    color: "#666",
  },
  profileCard: {
    borderWidth: 1,
    borderColor: "#175cd3",
    borderRadius: 8,
    padding: 12,
    gap: 4,
    backgroundColor: "#f5f9ff",
  },
  profileCardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#175cd3",
  },
  profileCardHint: {
    fontSize: 13,
    color: "#475467",
  },
  card: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  badge: {
    fontSize: 12,
    fontWeight: "600",
    color: "#175cd3",
  },
  meta: {
    fontSize: 13,
    color: "#666",
  },
  empty: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    textAlign: "center",
    paddingVertical: 24,
  },
  error: {
    color: "#b42318",
    textAlign: "center",
  },
});
