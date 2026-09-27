import NetInfo from "@react-native-community/netinfo";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ScorekeeperStatsView } from "@/components/capture/ScorekeeperStatsView";
import { MatchStopwatch } from "@/components/capture/MatchStopwatch";
import { TeamBadge } from "@/components/capture/TeamBadge";
import { useAuth } from "@/lib/auth/session";
import { createClientDedupKey } from "@/lib/capture/dedup-key";
import { classifySyncError } from "@/lib/capture/network-error";
import {
  loadPendingEvents,
  loadPendingRosterValidations,
  savePendingEvents,
  savePendingRosterValidations,
} from "@/lib/capture/storage";
import { getSupabase } from "@/lib/supabase/client";
import {
  addPendingEvent,
  addPendingRosterValidation,
  applyEventSyncOutcome,
  applyRosterSyncOutcome,
  pendingEventsForMatch,
  pendingRosterForMatch,
  type PendingMatchEvent,
  type SyncOutcome,
} from "@/lib/sync/offline-queue";
import {
  fetchMatchRosterForCapture,
  formatRosterSuspensionAlert,
  type MatchRosterCapturePlayer,
  type MatchRosterForCapture,
} from "@ligapro/shared";

type RecentEvent = {
  id: string;
  eventType: string;
  minute: number;
  createdAt: string;
  playerName: string;
  assistName: string | null;
};

type CaptureStep =
  | "idle"
  | "goal_team"
  | "goal_scorer"
  | "goal_assist"
  | "card_team"
  | "card_player"
  | "card_type"
  | "sub_team"
  | "sub_out"
  | "sub_in";

const VOID_WINDOW_MS = 3 * 60 * 1000;
const DEFAULT_VOID_REASON = "Corrección del árbitro";

function eventLabel(type: string): string {
  switch (type) {
    case "goal":
      return "Gol";
    case "yellow_card":
      return "Amarilla";
    case "red_card":
      return "Roja";
    case "substitution_out":
      return "Sale";
    case "substitution_in":
      return "Entra";
    default:
      return type;
  }
}

function playerLabel(player: MatchRosterCapturePlayer): string {
  const jersey =
    player.jerseyNumber != null ? `#${player.jerseyNumber} · ` : "";
  return `${jersey}${player.fullName}`;
}

function playedPlayers(
  players: MatchRosterCapturePlayer[]
): MatchRosterCapturePlayer[] {
  return players.filter((p) => p.participationStatus === "played");
}

function benchPlayers(
  players: MatchRosterCapturePlayer[]
): MatchRosterCapturePlayer[] {
  return players.filter((p) => p.participationStatus !== "played");
}

export default function MatchCaptureScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { user, loading: authLoading } = useAuth();

  const [canCapture, setCanCapture] = useState<boolean | null>(null);
  const [captureMode, setCaptureMode] = useState<
    "referee" | "scorekeeper" | null
  >(null);
  const [roster, setRoster] = useState<MatchRosterForCapture | null>(null);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [selectedPlayed, setSelectedPlayed] = useState<Set<string>>(new Set());
  const [rosterCollapsed, setRosterCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [minute, setMinute] = useState(0);
  const [pendingEvents, setPendingEvents] = useState<PendingMatchEvent[]>([]);
  const [pendingRoster, setPendingRoster] = useState<
    ReturnType<typeof pendingRosterForMatch>
  >(null);
  const [syncing, setSyncing] = useState(false);

  const [step, setStep] = useState<CaptureStep>("idle");
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const matchPendingEvents = useMemo(
    () => pendingEventsForMatch(pendingEvents, matchId ?? ""),
    [pendingEvents, matchId]
  );

  const loadRecentEvents = useCallback(async () => {
    if (!matchId) return;
    const supabase = getSupabase();
    const { data } = await supabase
      .from("match_events")
      .select(
        "id, event_type, minute, created_at, season_team_player_id, assist_season_team_player_id, season_team_players!season_team_player_id(players(full_name))"
      )
      .eq("match_id", matchId)
      .is("voided_at", null)
      .order("created_at", { ascending: false })
      .limit(8);

    const nameByStp = new Map<string, string>();
    for (const player of [
      ...(roster?.homePlayers ?? []),
      ...(roster?.awayPlayers ?? []),
    ]) {
      nameByStp.set(player.seasonTeamPlayerId, player.fullName);
    }

    setRecentEvents(
      (data ?? []).map((row) => {
        const playerRel = row.season_team_players as
          | { players: { full_name: string } | { full_name: string }[] | null }
          | { players: { full_name: string } | { full_name: string }[] | null }[]
          | null;
        const player = Array.isArray(playerRel) ? playerRel[0] : playerRel;
        const playerNameRel = player?.players;
        const playerNameRow = Array.isArray(playerNameRel)
          ? playerNameRel[0]
          : playerNameRel;

        return {
          id: row.id,
          eventType: row.event_type,
          minute: row.minute,
          createdAt: row.created_at,
          playerName:
            playerNameRow?.full_name ??
            nameByStp.get(row.season_team_player_id) ??
            "Jugador",
          assistName: row.assist_season_team_player_id
            ? nameByStp.get(row.assist_season_team_player_id) ?? null
            : null,
        };
      })
    );
  }, [matchId, roster?.homePlayers, roster?.awayPlayers]);

  const refreshRoster = useCallback(async () => {
    if (!matchId) return;
    const supabase = getSupabase();
    const data = await fetchMatchRosterForCapture(supabase, matchId);
    setRoster(data);
    if (data) {
      const playedIds = [...data.homePlayers, ...data.awayPlayers]
        .filter((p) => p.participationStatus === "played")
        .map((p) => p.seasonTeamPlayerId);
      setSelectedPlayed(new Set(playedIds));
      if (playedIds.length > 0) setRosterCollapsed(true);
    }
  }, [matchId]);

  const loadAll = useCallback(async () => {
    if (!matchId || !user) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const [
        { data: allowed },
        { data: official },
        rosterData,
        eventsQueue,
        rosterQueue,
      ] = await Promise.all([
        supabase.rpc("can_capture_match", { p_match_id: matchId }),
        supabase
          .from("match_officials")
          .select("role, status")
          .eq("match_id", matchId)
          .eq("profile_id", user.id)
          .eq("status", "confirmed")
          .maybeSingle(),
        fetchMatchRosterForCapture(supabase, matchId),
        loadPendingEvents(),
        loadPendingRosterValidations(),
      ]);

      const mode =
        official?.role === "scorekeeper" ? "scorekeeper" : "referee";

      setCanCapture(Boolean(allowed));
      setCaptureMode(mode);
      setRoster(rosterData);

      if (mode === "referee") {
        setPendingEvents(eventsQueue);
        setPendingRoster(pendingRosterForMatch(rosterQueue, matchId));

        if (rosterData) {
          const playedIds = [...rosterData.homePlayers, ...rosterData.awayPlayers]
            .filter((p) => p.participationStatus === "played")
            .map((p) => p.seasonTeamPlayerId);
          setSelectedPlayed(new Set(playedIds));
          if (playedIds.length > 0) setRosterCollapsed(true);
        }
      }

      if (allowed && mode === "referee") {
        await loadRecentEvents();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar captura");
    } finally {
      setLoading(false);
    }
  }, [matchId, user, refreshRoster, loadRecentEvents]);

  useEffect(() => {
    if (!user || !matchId) return;
    loadAll();
  }, [user, matchId, loadAll]);

  const flushQueues = useCallback(async () => {
    if (!matchId || syncing) return;
    setSyncing(true);
    setActionMessage(null);

    try {
      const supabase = getSupabase();
      let eventsQueue = await loadPendingEvents();
      let rosterQueue = await loadPendingRosterValidations();
      const businessMessages: string[] = [];

      for (const item of [...eventsQueue]) {
        if (item.matchId !== matchId) continue;
        try {
          const { error: rpcError } = await supabase.rpc("record_match_event", {
            p_match_id: item.matchId,
            p_season_team_player_id: item.seasonTeamPlayerId,
            p_event_type: item.eventType,
            p_minute: item.minute,
            p_notes: item.notes ?? undefined,
            p_assist_season_team_player_id:
              item.assistSeasonTeamPlayerId ?? undefined,
            p_client_dedup_key: item.clientDedupKey,
          });

          let outcome: SyncOutcome;
          if (rpcError) {
            outcome = classifySyncError(rpcError);
          } else {
            outcome = { kind: "success" };
          }

          const applied = applyEventSyncOutcome(
            eventsQueue,
            item.queueId,
            outcome
          );
          eventsQueue = applied.queue;
          if (applied.message) businessMessages.push(applied.message);
        } catch (err) {
          const outcome = classifySyncError(err);
          const applied = applyEventSyncOutcome(
            eventsQueue,
            item.queueId,
            outcome
          );
          eventsQueue = applied.queue;
        }
      }

      for (const item of [...rosterQueue]) {
        if (item.matchId !== matchId) continue;
        try {
          const { error: rpcError } = await supabase.rpc(
            "validate_match_roster",
            {
              p_match_id: item.matchId,
              p_season_team_player_ids: item.seasonTeamPlayerIds,
            }
          );

          let outcome: SyncOutcome;
          if (rpcError) {
            outcome = classifySyncError(rpcError);
          } else {
            outcome = { kind: "success" };
          }

          const applied = applyRosterSyncOutcome(
            rosterQueue,
            item.queueId,
            outcome
          );
          rosterQueue = applied.queue;
          if (applied.message) businessMessages.push(applied.message);
        } catch (err) {
          const applied = applyRosterSyncOutcome(
            rosterQueue,
            item.queueId,
            classifySyncError(err)
          );
          rosterQueue = applied.queue;
        }
      }

      await savePendingEvents(eventsQueue);
      await savePendingRosterValidations(rosterQueue);
      setPendingEvents(eventsQueue);
      setPendingRoster(pendingRosterForMatch(rosterQueue, matchId));

      await Promise.all([refreshRoster(), loadRecentEvents()]);

      if (businessMessages.length) {
        setActionMessage(businessMessages.join(" · "));
      } else {
        setActionMessage("Cola sincronizada.");
      }
    } finally {
      setSyncing(false);
    }
  }, [matchId, syncing, refreshRoster, loadRecentEvents]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        flushQueues();
      }
    });
    return unsubscribe;
  }, [flushQueues]);

  async function recordEvent(input: {
    seasonTeamPlayerId: string;
    eventType: string;
    assistSeasonTeamPlayerId?: string | null;
  }) {
    if (!matchId) return;

    const item: PendingMatchEvent = {
      queueId: createClientDedupKey(),
      clientDedupKey: createClientDedupKey(),
      matchId,
      seasonTeamPlayerId: input.seasonTeamPlayerId,
      eventType: input.eventType,
      minute,
      notes: null,
      assistSeasonTeamPlayerId: input.assistSeasonTeamPlayerId ?? null,
      createdAt: new Date().toISOString(),
      lastError: null,
    };

    const supabase = getSupabase();
    try {
      const { error: rpcError } = await supabase.rpc("record_match_event", {
        p_match_id: item.matchId,
        p_season_team_player_id: item.seasonTeamPlayerId,
        p_event_type: item.eventType,
        p_minute: item.minute,
        p_notes: undefined,
        p_assist_season_team_player_id:
          item.assistSeasonTeamPlayerId ?? undefined,
        p_client_dedup_key: item.clientDedupKey,
      });

      if (rpcError) {
        const outcome = classifySyncError(rpcError);
        if (outcome.kind === "network") {
          const next = addPendingEvent(pendingEvents, item);
          await savePendingEvents(next);
          setPendingEvents(next);
          setActionMessage("Evento guardado como pendiente de envío.");
          return;
        }
        setActionMessage(outcome.message);
        return;
      }

      setActionMessage("Evento registrado.");
      await loadRecentEvents();
    } catch (err) {
      const outcome = classifySyncError(err);
      if (outcome.kind === "network") {
        const next = addPendingEvent(pendingEvents, item);
        await savePendingEvents(next);
        setPendingEvents(next);
        setActionMessage("Evento guardado como pendiente de envío.");
        return;
      }
      setActionMessage(outcome.message);
    }
  }

  async function validateRosterNow() {
    if (!matchId) return;
    const ids = [...selectedPlayed];
    const queueItem = {
      queueId: createClientDedupKey(),
      matchId,
      seasonTeamPlayerIds: ids,
      createdAt: new Date().toISOString(),
      lastError: null,
    };

    const supabase = getSupabase();
    try {
      const { error: rpcError } = await supabase.rpc("validate_match_roster", {
        p_match_id: matchId,
        p_season_team_player_ids: ids,
      });

      if (rpcError) {
        const outcome = classifySyncError(rpcError);
        if (outcome.kind === "network") {
          const rosterQueue = addPendingRosterValidation(
            await loadPendingRosterValidations(),
            queueItem
          );
          await savePendingRosterValidations(rosterQueue);
          setPendingRoster(queueItem);
          setActionMessage("Validación guardada como pendiente de envío.");
          return;
        }
        setActionMessage(outcome.message);
        return;
      }

      setActionMessage("Plantel validado.");
      setRosterCollapsed(true);
      await refreshRoster();
    } catch (err) {
      const outcome = classifySyncError(err);
      if (outcome.kind === "network") {
        const rosterQueue = addPendingRosterValidation(
          await loadPendingRosterValidations(),
          queueItem
        );
        await savePendingRosterValidations(rosterQueue);
        setPendingRoster(queueItem);
        setActionMessage("Validación guardada como pendiente de envío.");
        return;
      }
      setActionMessage(outcome.message);
    }
  }

  async function voidEvent(eventId: string) {
    const supabase = getSupabase();
    const { error: rpcError } = await supabase.rpc("void_match_event", {
      p_event_id: eventId,
      p_reason: DEFAULT_VOID_REASON,
    });

    if (rpcError) {
      Alert.alert("No se pudo deshacer", rpcError.message);
      return;
    }

    setActionMessage("Evento anulado.");
    await loadRecentEvents();
  }

  function togglePlayed(id: string) {
    setSelectedPlayed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function resetStep() {
    setStep("idle");
    setActiveTeamId(null);
    setSelectedPlayerId(null);
  }

  function teamPlayers(teamId: string | null): MatchRosterCapturePlayer[] {
    if (!roster || !teamId) return [];
    return teamId === roster.homeSeasonTeamId
      ? roster.homePlayers
      : roster.awayPlayers;
  }

  if (!authLoading && !user) {
    return <Redirect href="/login" />;
  }

  if (loading || canCapture === null || captureMode === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!canCapture) {
    return (
      <View style={styles.container}>
        <Text style={styles.blockedTitle}>Sin permiso de captura</Text>
        <Text style={styles.blockedText}>
          Tu cuenta no puede capturar este partido. Verifica que tengas una
          asignación confirmada como árbitro o anotador.
        </Text>
      </View>
    );
  }

  if (!roster) {
    return (
      <View style={styles.container}>
        <Text>No encontramos el partido.</Text>
      </View>
    );
  }

  if (captureMode === "scorekeeper") {
    return <ScorekeeperStatsView matchId={matchId!} roster={roster} />;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.matchTitle}>
        {roster.homeTeamName} vs {roster.awayTeamName}
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {actionMessage ? <Text style={styles.info}>{actionMessage}</Text> : null}

      {!rosterCollapsed ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Validación express de plantel</Text>
          <Text style={styles.sectionHint}>
            Marca quién está presente. Quien no se seleccione quedará como
            no_show al validar.
          </Text>
          {[...roster.homePlayers, ...roster.awayPlayers].map((player) => {
            const suspensionAlert = formatRosterSuspensionAlert(player);

            return (
              <Pressable
                key={player.seasonTeamPlayerId}
                style={[
                  styles.playerRow,
                  player.isSuspended && styles.playerRowSuspended,
                  selectedPlayed.has(player.seasonTeamPlayerId) &&
                    styles.playerRowSelected,
                ]}
                onPress={() => togglePlayed(player.seasonTeamPlayerId)}
              >
                <View style={styles.playerRowHeader}>
                  <Text style={styles.playerText}>{playerLabel(player)}</Text>
                  {suspensionAlert ? (
                    <Text style={styles.suspensionBadge}>{suspensionAlert}</Text>
                  ) : null}
                </View>
                <Text style={styles.playerMeta}>
                  {player.seasonTeamId === roster.homeSeasonTeamId
                    ? roster.homeTeamName
                    : roster.awayTeamName}
                  {player.participationStatus
                    ? ` · ${player.participationStatus}`
                    : ""}
                </Text>
              </Pressable>
            );
          })}
          <Button title="Validar plantel" onPress={validateRosterNow} />
          {pendingRoster ? (
            <Text style={styles.pending}>Validación pendiente de envío</Text>
          ) : null}
        </View>
      ) : (
        <Pressable onPress={() => setRosterCollapsed(false)}>
          <Text style={styles.link}>Editar validación de plantel</Text>
        </Pressable>
      )}

      <MatchStopwatch
        halfDurationMinutes={roster.halfDurationMinutes}
        onMinuteChange={setMinute}
      />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Minuto del evento</Text>
        <TextInput
          keyboardType="number-pad"
          value={String(minute)}
          onChangeText={(value) => setMinute(Number(value.replace(/\D/g, "")) || 0)}
          style={styles.minuteInput}
        />
      </View>

      {step === "idle" ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Capturar evento</Text>
          <Button title="Gol" onPress={() => setStep("goal_team")} />
          <Button title="Tarjeta" onPress={() => setStep("card_team")} />
          <Button title="Cambio" onPress={() => setStep("sub_team")} />
        </View>
      ) : null}

      {step === "goal_team" ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gol — selecciona equipo</Text>
          <TeamBadge
            name={roster.homeTeamName}
            logoUrl={roster.homeTeamLogoUrl}
            onPress={() => {
              setActiveTeamId(roster.homeSeasonTeamId);
              setStep("goal_scorer");
            }}
          />
          <TeamBadge
            name={roster.awayTeamName}
            logoUrl={roster.awayTeamLogoUrl}
            onPress={() => {
              setActiveTeamId(roster.awaySeasonTeamId);
              setStep("goal_scorer");
            }}
          />
          <Button title="Cancelar" onPress={resetStep} />
        </View>
      ) : null}

      {step === "goal_scorer" ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gol — selecciona autor</Text>
          {playedPlayers(teamPlayers(activeTeamId)).map((player) => (
            <Pressable
              key={player.seasonTeamPlayerId}
              style={styles.playerRow}
              onPress={() => {
                setSelectedPlayerId(player.seasonTeamPlayerId);
                setStep("goal_assist");
              }}
            >
              <Text style={styles.playerText}>{playerLabel(player)}</Text>
            </Pressable>
          ))}
          <Button title="Cancelar" onPress={resetStep} />
        </View>
      ) : null}

      {step === "goal_assist" ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>¿Asistencia?</Text>
          <Button
            title="Sin asistencia"
            onPress={async () => {
              if (!selectedPlayerId) return;
              await recordEvent({
                seasonTeamPlayerId: selectedPlayerId,
                eventType: "goal",
              });
              resetStep();
            }}
          />
          {playedPlayers(teamPlayers(activeTeamId))
            .filter((p) => p.seasonTeamPlayerId !== selectedPlayerId)
            .map((player) => (
              <Pressable
                key={player.seasonTeamPlayerId}
                style={styles.playerRow}
                onPress={async () => {
                  if (!selectedPlayerId) return;
                  await recordEvent({
                    seasonTeamPlayerId: selectedPlayerId,
                    eventType: "goal",
                    assistSeasonTeamPlayerId: player.seasonTeamPlayerId,
                  });
                  resetStep();
                }}
              >
                <Text style={styles.playerText}>{playerLabel(player)}</Text>
              </Pressable>
            ))}
          <Button title="Cancelar" onPress={resetStep} />
        </View>
      ) : null}

      {step === "card_team" ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tarjeta — selecciona equipo</Text>
          <TeamBadge
            name={roster.homeTeamName}
            logoUrl={roster.homeTeamLogoUrl}
            onPress={() => {
              setActiveTeamId(roster.homeSeasonTeamId);
              setStep("card_player");
            }}
          />
          <TeamBadge
            name={roster.awayTeamName}
            logoUrl={roster.awayTeamLogoUrl}
            onPress={() => {
              setActiveTeamId(roster.awaySeasonTeamId);
              setStep("card_player");
            }}
          />
          <Button title="Cancelar" onPress={resetStep} />
        </View>
      ) : null}

      {step === "card_player" ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tarjeta — selecciona jugador</Text>
          {playedPlayers(teamPlayers(activeTeamId)).map((player) => (
            <Pressable
              key={player.seasonTeamPlayerId}
              style={styles.playerRow}
              onPress={() => {
                setSelectedPlayerId(player.seasonTeamPlayerId);
                setStep("card_type");
              }}
            >
              <Text style={styles.playerText}>{playerLabel(player)}</Text>
            </Pressable>
          ))}
          <Button title="Cancelar" onPress={resetStep} />
        </View>
      ) : null}

      {step === "card_type" ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tipo de tarjeta</Text>
          <Button
            title="Amarilla"
            onPress={async () => {
              if (!selectedPlayerId) return;
              await recordEvent({
                seasonTeamPlayerId: selectedPlayerId,
                eventType: "yellow_card",
              });
              resetStep();
            }}
          />
          <Button
            title="Roja"
            onPress={async () => {
              if (!selectedPlayerId) return;
              await recordEvent({
                seasonTeamPlayerId: selectedPlayerId,
                eventType: "red_card",
              });
              resetStep();
            }}
          />
          <Button title="Cancelar" onPress={resetStep} />
        </View>
      ) : null}

      {step === "sub_team" ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cambio — selecciona equipo</Text>
          <TeamBadge
            name={roster.homeTeamName}
            logoUrl={roster.homeTeamLogoUrl}
            onPress={() => {
              setActiveTeamId(roster.homeSeasonTeamId);
              setStep("sub_out");
            }}
          />
          <TeamBadge
            name={roster.awayTeamName}
            logoUrl={roster.awayTeamLogoUrl}
            onPress={() => {
              setActiveTeamId(roster.awaySeasonTeamId);
              setStep("sub_out");
            }}
          />
          <Button title="Cancelar" onPress={resetStep} />
        </View>
      ) : null}

      {step === "sub_out" ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cambio — jugador que sale</Text>
          {playedPlayers(teamPlayers(activeTeamId)).map((player) => (
            <Pressable
              key={player.seasonTeamPlayerId}
              style={styles.playerRow}
              onPress={() => {
                setSelectedPlayerId(player.seasonTeamPlayerId);
                setStep("sub_in");
              }}
            >
              <Text style={styles.playerText}>{playerLabel(player)}</Text>
            </Pressable>
          ))}
          <Button title="Cancelar" onPress={resetStep} />
        </View>
      ) : null}

      {step === "sub_in" ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cambio — jugador que entra</Text>
          {(benchPlayers(teamPlayers(activeTeamId)).length
            ? benchPlayers(teamPlayers(activeTeamId))
            : teamPlayers(activeTeamId)
          ).map((player) => (
            <Pressable
              key={player.seasonTeamPlayerId}
              style={styles.playerRow}
              onPress={async () => {
                if (!selectedPlayerId) return;
                await recordEvent({
                  seasonTeamPlayerId: selectedPlayerId,
                  eventType: "substitution_out",
                });
                await recordEvent({
                  seasonTeamPlayerId: player.seasonTeamPlayerId,
                  eventType: "substitution_in",
                });
                resetStep();
              }}
            >
              <Text style={styles.playerText}>{playerLabel(player)}</Text>
            </Pressable>
          ))}
          <Button title="Cancelar" onPress={resetStep} />
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pendientes de envío</Text>
        {matchPendingEvents.length === 0 ? (
          <Text style={styles.sectionHint}>No hay eventos pendientes.</Text>
        ) : (
          matchPendingEvents.map((item) => (
            <Text key={item.queueId} style={styles.pending}>
              ⏳ {eventLabel(item.eventType)} · min {item.minute}
              {item.lastError ? ` · ${item.lastError}` : ""}
            </Text>
          ))
        )}
        <Button
          title={syncing ? "Reintentando…" : "Reintentar envío"}
          onPress={flushQueues}
          disabled={syncing}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Últimos eventos</Text>
        {recentEvents.map((event) => {
          const canVoid =
            Date.now() - new Date(event.createdAt).getTime() < VOID_WINDOW_MS;
          return (
            <View key={event.id} style={styles.eventRow}>
              <Text style={styles.playerText}>
                {eventLabel(event.eventType)} · min {event.minute} ·{" "}
                {event.playerName}
                {event.assistName ? ` (asist: ${event.assistName})` : ""}
              </Text>
              {canVoid ? (
                <Button title="Deshacer" onPress={() => voidEvent(event.id)} />
              ) : null}
            </View>
          );
        })}
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
  },
  matchTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  section: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  sectionHint: {
    fontSize: 13,
    color: "#666",
  },
  playerRow: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  playerRowSuspended: {
    borderColor: "#f79009",
    backgroundColor: "#fffaeb",
  },
  playerRowSelected: {
    borderColor: "#111",
    backgroundColor: "#f5f5f5",
  },
  playerRowHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  playerText: {
    fontSize: 16,
    fontWeight: "600",
    flexShrink: 1,
  },
  suspensionBadge: {
    fontSize: 12,
    fontWeight: "700",
    color: "#b54708",
    backgroundColor: "#fef0c7",
    borderWidth: 1,
    borderColor: "#f79009",
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  playerMeta: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  minuteInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
  },
  pending: {
    color: "#b54708",
    fontSize: 14,
  },
  info: {
    color: "#027a48",
    fontSize: 14,
  },
  error: {
    color: "#b42318",
  },
  blockedTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  blockedText: {
    fontSize: 15,
    color: "#444",
  },
  link: {
    color: "#111",
    fontWeight: "600",
    marginBottom: 8,
  },
  eventRow: {
    gap: 6,
    marginBottom: 8,
  },
});
