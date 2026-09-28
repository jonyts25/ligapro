import { Redirect, router, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Button,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { PlayerAvatarBadge } from "@/components/captain/PlayerAvatarBadge";
import { useAuth } from "@/lib/auth/session";
import {
  addExistingPlayerToRoster,
  createPlayerAndAddToRoster,
  findPotentialDuplicatePlayers,
  invitePlayerToClaimProfile,
  updateCaptainJersey,
} from "@/lib/captain/roster-actions";
import { resolvePlayerPhotoUrl } from "@/lib/players/photo-url";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  buildCaptainWhatsAppLink,
  buildMatchCaptainContactMessage,
  duplicateConfirmationMessage,
  normalizePlayerPhoneForSearch,
  fetchCaptainRosterCore,
  fetchCaptainUpcomingMatchesCore,
  fetchOpponentCaptainPhoneCore,
  fetchSeasonTeamSeasonId,
  formatCaptainMatchScore,
  getPersonContexts,
  registrationStatusLabel,
  type CaptainMatchCore,
  type CaptainRosterPlayerCore,
  type PersonPlayerTeam,
  type PotentialDuplicatePlayer,
} from "@ligapro/shared";

type TabKey = "plantel" | "partidos";

function formatMatchDate(iso: string | null): string {
  if (!iso) return "Sin programación";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  }).format(new Date(iso));
}

function RosterLockedBanner() {
  return (
    <Text style={styles.lockedBanner}>
      El plantel está bloqueado. Contacta al administrador para cualquier cambio
      (dorsales y altas).
    </Text>
  );
}

function DuplicateConfirmationCard({
  duplicate,
  onConfirmExisting,
  onCreateNew,
  onDismiss,
  pending,
}: {
  duplicate: PotentialDuplicatePlayer;
  onConfirmExisting: () => void;
  onCreateNew: () => void;
  onDismiss: () => void;
  pending: boolean;
}) {
  return (
    <View style={styles.duplicateCard}>
      <Text style={styles.duplicateTitle}>Posible jugador duplicado</Text>
      <Text style={styles.duplicateMessage}>
        {duplicateConfirmationMessage(duplicate)}
      </Text>
      <View style={styles.duplicateActions}>
        <Button
          title="Es la misma persona — usar su registro"
          onPress={onConfirmExisting}
          disabled={pending}
        />
        <Button
          title="Es alguien distinto — crear nuevo"
          onPress={onCreateNew}
          disabled={pending}
        />
        <Button title="Cancelar" onPress={onDismiss} disabled={pending} />
      </View>
    </View>
  );
}

export default function CaptainTeamScreen() {
  const { seasonTeamId } = useLocalSearchParams<{ seasonTeamId: string }>();
  const { session, user, loading } = useAuth();
  const [teamContext, setTeamContext] = useState<PersonPlayerTeam | null>(null);
  const [roster, setRoster] = useState<CaptainRosterPlayerCore[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map());
  const [matches, setMatches] = useState<CaptainMatchCore[]>([]);
  const [opponentPhones, setOpponentPhones] = useState<Map<string, string>>(new Map());
  const [requireVerification, setRequireVerification] = useState(false);
  const [rosterLocked, setRosterLocked] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("plantel");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const [editingJerseyId, setEditingJerseyId] = useState<string | null>(null);
  const [jerseyDraft, setJerseyDraft] = useState("");
  const [inviteTargetId, setInviteTargetId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [addFullName, setAddFullName] = useState("");
  const [addJersey, setAddJersey] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [pendingDuplicate, setPendingDuplicate] =
    useState<PotentialDuplicatePlayer | null>(null);

  const isLeaderTeam = useMemo(
    () => Boolean(teamContext?.isCaptain || teamContext?.isViceCaptain),
    [teamContext],
  );

  const loadData = useCallback(async () => {
    if (!user || !seasonTeamId) return;

    try {
      const supabase = getSupabase();
      const contexts = await getPersonContexts(supabase, user.id);
      const team = contexts.equiposComoJugador.find(
        (entry) =>
          entry.seasonTeamId === seasonTeamId &&
          (entry.isCaptain || entry.isViceCaptain),
      );

      if (!team) {
        setTeamContext(null);
        setFetchError(null);
        return;
      }

      setTeamContext(team);

      const resolvedSeasonId =
        (await fetchSeasonTeamSeasonId(supabase, seasonTeamId)) ?? null;
      if (!resolvedSeasonId) {
        throw new Error("No se encontró la temporada del equipo.");
      }

      const [rosterData, matchRows] = await Promise.all([
        fetchCaptainRosterCore(supabase, seasonTeamId, resolvedSeasonId),
        fetchCaptainUpcomingMatchesCore(
          supabase,
          seasonTeamId,
          resolvedSeasonId,
        ),
      ]);

      setRoster(rosterData.roster);
      setRequireVerification(rosterData.requirePlayerVerification);
      setRosterLocked(rosterData.rosterLockedByCaptain);
      setMatches(matchRows);

      const photoEntries = await Promise.all(
        rosterData.roster.map(async (player) => {
          const url = await resolvePlayerPhotoUrl(supabase, player.playerId);
          return [player.playerId, url] as const;
        }),
      );
      const photoMap = new Map<string, string>();
      for (const [playerId, url] of photoEntries) {
        if (url) photoMap.set(playerId, url);
      }
      setPhotoUrls(photoMap);

      const phoneEntries = await Promise.all(
        matchRows.map(async (match) => {
          const phone = await fetchOpponentCaptainPhoneCore(supabase, match);
          return [match.id, phone] as const;
        }),
      );
      setOpponentPhones(
        new Map(phoneEntries.filter(([, phone]) => phone) as [string, string][]),
      );

      setFetchError(null);
    } catch (error) {
      setFetchError(
        error instanceof Error ? error.message : "Error al cargar el equipo",
      );
    }
  }, [seasonTeamId, user]);

  useEffect(() => {
    if (!user) {
      setInitialLoading(false);
      return;
    }

    loadData().finally(() => setInitialLoading(false));
  }, [user, loadData]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  async function handleSaveJersey(seasonTeamPlayerId: string) {
    setActionPending(true);
    setActionMessage(null);
    try {
      const result = await updateCaptainJersey(
        getSupabase(),
        seasonTeamPlayerId,
        jerseyDraft,
      );
      if (!result.ok) {
        setActionMessage(result.message);
        return;
      }
      setEditingJerseyId(null);
      setJerseyDraft("");
      await loadData();
      setActionMessage("Dorsal actualizado.");
    } finally {
      setActionPending(false);
    }
  }

  async function handleInvitePlayer(seasonTeamPlayerId: string) {
    setActionPending(true);
    setActionMessage(null);
    try {
      const result = await invitePlayerToClaimProfile(
        getSupabase(),
        seasonTeamPlayerId,
        inviteEmail,
      );
      if (!result.ok) {
        setActionMessage(result.message);
        return;
      }
      setInviteTargetId(null);
      setInviteEmail("");
      setActionMessage(
        result.inviteUrl
          ? `Invitación creada: ${result.inviteUrl}`
          : "Invitación enviada.",
      );
    } finally {
      setActionPending(false);
    }
  }

  async function submitAddPlayer(
    mode: "normal" | "confirm-existing" | "force-new" = "normal",
  ) {
    if (!seasonTeamId || !teamContext) return;

    setActionPending(true);
    setActionMessage(null);

    try {
      const supabase = getSupabase();

      if (mode === "normal" && normalizePlayerPhoneForSearch(addPhone)) {
        const duplicates = await findPotentialDuplicatePlayers(
          supabase,
          teamContext.organizationId,
          addPhone,
        );
        if (duplicates.length > 0) {
          setPendingDuplicate(duplicates[0]!);
          return;
        }
      }

      let result: { ok: true } | { ok: false; message: string };
      if (mode === "confirm-existing" && pendingDuplicate) {
        result = await addExistingPlayerToRoster(
          supabase,
          pendingDuplicate.playerId,
          seasonTeamId,
          addJersey,
        );
      } else {
        result = await createPlayerAndAddToRoster(
          supabase,
          seasonTeamId,
          addFullName,
          addJersey,
          addPhone,
        );
      }

      if (!result.ok) {
        setActionMessage(result.message);
        return;
      }

      setAddFullName("");
      setAddJersey("");
      setAddPhone("");
      setPendingDuplicate(null);
      await loadData();
      setActionMessage("Jugador agregado al plantel.");
    } catch (error) {
      setActionMessage(
        error instanceof Error ? error.message : "No se pudo agregar al jugador.",
      );
    } finally {
      setActionPending(false);
    }
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

  if (!teamContext || !isLeaderTeam) {
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
        <Text style={styles.title}>{teamContext.teamName}</Text>
        <Text style={styles.subtitle}>
          {teamContext.competitionName} · {teamContext.seasonName}
        </Text>
        <Text style={styles.subtitle}>{teamContext.organizationName}</Text>
        <Text style={styles.leaderBadge}>
          {teamContext.isCaptain ? "Capitán" : "Subcapitán"}
        </Text>
      </View>

      {fetchError ? <Text style={styles.error}>{fetchError}</Text> : null}
      {actionMessage ? <Text style={styles.info}>{actionMessage}</Text> : null}

      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, activeTab === "plantel" && styles.tabActive]}
          onPress={() => setActiveTab("plantel")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "plantel" && styles.tabTextActive,
            ]}
          >
            Plantel
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "partidos" && styles.tabActive]}
          onPress={() => setActiveTab("partidos")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "partidos" && styles.tabTextActive,
            ]}
          >
            Partidos
          </Text>
        </Pressable>
      </View>

      {activeTab === "plantel" ? (
        <View style={styles.section}>
          {rosterLocked ? <RosterLockedBanner /> : null}

          {roster.length === 0 ? (
            <Text style={styles.empty}>No hay jugadores en el plantel.</Text>
          ) : (
            roster.map((player) => (
              <View key={player.id} style={styles.card}>
                <View style={styles.playerRow}>
                  <PlayerAvatarBadge
                    name={player.fullName}
                    photoUrl={photoUrls.get(player.playerId) ?? null}
                  />
                  <View style={styles.playerInfo}>
                    <View style={styles.playerHeader}>
                      <Text style={styles.playerName}>{player.fullName}</Text>
                      {player.isCaptain ? (
                        <Text style={styles.badge}>Capitán</Text>
                      ) : player.isViceCaptain ? (
                        <Text style={styles.badge}>Subcapitán</Text>
                      ) : null}
                    </View>
                    <Text style={styles.meta}>
                      {registrationStatusLabel(player.registrationStatus)}
                      {requireVerification && player.verificationStatus !== "not_required"
                        ? ` · ${player.verificationStatus}`
                        : ""}
                    </Text>
                    {rosterLocked ? (
                      <Text style={styles.meta}>
                        {player.jerseyNumber != null
                          ? `Dorsal ${player.jerseyNumber}`
                          : "Sin dorsal"}
                      </Text>
                    ) : editingJerseyId === player.id ? (
                      <View style={styles.inlineForm}>
                        <TextInput
                          style={styles.input}
                          value={jerseyDraft}
                          onChangeText={setJerseyDraft}
                          keyboardType="number-pad"
                          placeholder="Dorsal"
                        />
                        <Button
                          title="Guardar"
                          onPress={() => void handleSaveJersey(player.id)}
                          disabled={actionPending}
                        />
                        <Button
                          title="Cancelar"
                          onPress={() => {
                            setEditingJerseyId(null);
                            setJerseyDraft("");
                          }}
                        />
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => {
                          setEditingJerseyId(player.id);
                          setJerseyDraft(
                            player.jerseyNumber != null
                              ? String(player.jerseyNumber)
                              : "",
                          );
                        }}
                      >
                        <Text style={styles.link}>
                          {player.jerseyNumber != null
                            ? `Dorsal ${player.jerseyNumber} · Editar`
                            : "Asignar dorsal"}
                        </Text>
                      </Pressable>
                    )}

                    {!player.profileId ? (
                      inviteTargetId === player.id ? (
                        <View style={styles.inlineForm}>
                          <TextInput
                            style={styles.input}
                            value={inviteEmail}
                            onChangeText={setInviteEmail}
                            placeholder="Correo de invitación"
                            keyboardType="email-address"
                            autoCapitalize="none"
                          />
                          <Button
                            title="Enviar invitación"
                            onPress={() => void handleInvitePlayer(player.id)}
                            disabled={actionPending}
                          />
                          <Button
                            title="Cancelar"
                            onPress={() => {
                              setInviteTargetId(null);
                              setInviteEmail("");
                            }}
                          />
                        </View>
                      ) : (
                        <Pressable onPress={() => setInviteTargetId(player.id)}>
                          <Text style={styles.link}>
                            Invitar a reclamar su perfil
                          </Text>
                        </Pressable>
                      )
                    ) : null}
                  </View>
                </View>
              </View>
            ))
          )}

          {!rosterLocked ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Agregar jugador</Text>
              {pendingDuplicate ? (
                <DuplicateConfirmationCard
                  duplicate={pendingDuplicate}
                  pending={actionPending}
                  onConfirmExisting={() => void submitAddPlayer("confirm-existing")}
                  onCreateNew={() => void submitAddPlayer("force-new")}
                  onDismiss={() => setPendingDuplicate(null)}
                />
              ) : (
                <View style={styles.form}>
                  <TextInput
                    style={styles.input}
                    value={addFullName}
                    onChangeText={setAddFullName}
                    placeholder="Nombre completo"
                  />
                  <TextInput
                    style={styles.input}
                    value={addJersey}
                    onChangeText={setAddJersey}
                    placeholder="Dorsal (opcional)"
                    keyboardType="number-pad"
                  />
                  <TextInput
                    style={styles.input}
                    value={addPhone}
                    onChangeText={setAddPhone}
                    placeholder="Teléfono / WhatsApp (opcional)"
                    keyboardType="phone-pad"
                  />
                  <Text style={styles.hint}>
                    Si coincide con un jugador existente, te pediremos confirmación
                    antes de crear uno nuevo.
                  </Text>
                  <Button
                    title="Agregar al plantel"
                    onPress={() => void submitAddPlayer("normal")}
                    disabled={actionPending || addFullName.trim().length < 2}
                  />
                </View>
              )}
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.section}>
          {matches.length === 0 ? (
            <Text style={styles.empty}>No hay partidos próximos programados.</Text>
          ) : (
            matches.map((match) => {
              const score = formatCaptainMatchScore(match);
              const opponentPhone = opponentPhones.get(match.id) ?? null;
              const whatsAppHref = opponentPhone
                ? buildCaptainWhatsAppLink(
                    opponentPhone,
                    buildMatchCaptainContactMessage({
                      teamName: teamContext.teamName,
                      opponentName: match.opponentName,
                      isOwnHome: match.isOwnHome,
                    }),
                  )
                : null;

              return (
                <View key={match.id} style={styles.card}>
                  <Text style={styles.cardTitle}>
                    {match.isOwnHome ? "vs" : "@"} {match.opponentName}
                  </Text>
                  <Text style={styles.meta}>
                    Jornada {match.roundNumber ?? "—"}
                    {match.legNumber ? ` · Vuelta ${match.legNumber}` : ""}
                  </Text>
                  <Text style={styles.meta}>{formatMatchDate(match.startsAt)}</Text>
                  <Text style={styles.meta}>
                    {[match.venueName, match.fieldName].filter(Boolean).join(" · ") ||
                      "Sin sede / cancha"}
                  </Text>
                  {score ? <Text style={styles.score}>Marcador: {score}</Text> : null}
                  <Text style={styles.meta}>
                    {match.calendarStatus === "confirmado"
                      ? "Confirmado"
                      : "Programado"}
                  </Text>
                  {whatsAppHref ? (
                    <Button
                      title="WhatsApp al capitán rival"
                      onPress={() => void Linking.openURL(whatsAppHref)}
                    />
                  ) : (
                    <Text style={styles.hint}>
                      El capitán rival no tiene teléfono registrado.
                    </Text>
                  )}
                </View>
              );
            })
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
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
    gap: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
  },
  leaderBadge: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "600",
    color: "#175cd3",
  },
  tabs: {
    flexDirection: "row",
    gap: 8,
  },
  tab: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  tabActive: {
    borderColor: "#111",
    backgroundColor: "#f5f5f5",
  },
  tabText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#111",
  },
  section: {
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  playerRow: {
    flexDirection: "row",
    gap: 12,
  },
  playerInfo: {
    flex: 1,
    gap: 4,
  },
  playerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  playerName: {
    fontSize: 16,
    fontWeight: "600",
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
  score: {
    fontSize: 15,
    fontWeight: "700",
  },
  link: {
    fontSize: 13,
    color: "#175cd3",
    fontWeight: "600",
  },
  inlineForm: {
    gap: 8,
    marginTop: 4,
  },
  form: {
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  hint: {
    fontSize: 12,
    color: "#666",
  },
  lockedBanner: {
    borderWidth: 1,
    borderColor: "#f59e0b",
    backgroundColor: "#fffbeb",
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    color: "#666",
  },
  duplicateCard: {
    borderWidth: 1,
    borderColor: "#f59e0b",
    backgroundColor: "#fffbeb",
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  duplicateTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  duplicateMessage: {
    fontSize: 13,
    color: "#666",
  },
  duplicateActions: {
    gap: 8,
  },
  empty: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    paddingVertical: 16,
  },
  error: {
    color: "#b42318",
    textAlign: "center",
  },
  info: {
    color: "#027a48",
    textAlign: "center",
  },
});
