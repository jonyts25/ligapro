"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  scheduleMatchAction,
  unscheduleMatchAction,
} from "@/lib/fixtures/actions";
import {
  loadFieldAvailabilityAction,
  loadFieldOpenSlotsAction,
} from "@/lib/fixtures/availability-action";
import { addMinutesToLocalPreview } from "@/lib/fixtures/format";
import { formatOpenSlotLabel } from "@/lib/fixtures/open-slots";
import {
  fieldSchedulingLabel,
  initialFixtureActionState,
  type ActiveFieldOption,
  type FieldOpenSlot,
  type MatchSchedulingDetails,
} from "@/lib/fixtures/types";
import { FieldAvailabilitySummary } from "@/components/fixtures/FieldAvailabilitySummary";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";

type MatchSchedulingFormProps = {
  details: MatchSchedulingDetails;
  fields: ActiveFieldOption[];
  organizationId: string;
  canManage: boolean;
};

type OpenSlotsState = {
  slots: FieldOpenSlot[];
  hasWeeklyAvailability: boolean;
};

const emptyOpenSlots: OpenSlotsState = {
  slots: [],
  hasWeeklyAvailability: false,
};

export function MatchSchedulingForm({
  details,
  fields,
  organizationId,
  canManage,
}: MatchSchedulingFormProps) {
  const match = details.match;
  const [scheduleState, scheduleAction, schedulePending] = useActionState(
    scheduleMatchAction,
    initialFixtureActionState
  );
  const [unscheduleState, unscheduleAction, unschedulePending] = useActionState(
    unscheduleMatchAction,
    initialFixtureActionState
  );

  const [fieldId, setFieldId] = useState(
    () => scheduleState.values?.fieldId || match.schedule.fieldId || fields[0]?.id || ""
  );
  const [date, setDate] = useState(() => scheduleState.values?.date || "");
  const [time, setTime] = useState(() => scheduleState.values?.time || "");
  const [intervals, setIntervals] = useState<
    Array<{ startsAt: string; endsAt: string }>
  >([]);
  const [openSlots, setOpenSlots] = useState<OpenSlotsState>(emptyOpenSlots);
  const [availPending, startAvail] = useTransition();
  const [openSlotsPending, startOpenSlots] = useTransition();
  const [availKey, setAvailKey] = useState("");
  const [openSlotsKey, setOpenSlotsKey] = useState("");

  const effectiveFieldId = fields.some((f) => f.id === fieldId)
    ? fieldId
    : (fields[0]?.id ?? "");

  function refreshAvailability(nextFieldId: string, nextDate: string) {
    const key = `${nextFieldId}|${nextDate}`;
    if (!nextFieldId || !nextDate) {
      setIntervals([]);
      setAvailKey("");
      return;
    }
    setAvailKey(key);
    startAvail(async () => {
      const next = await loadFieldAvailabilityAction(
        organizationId,
        nextFieldId,
        nextDate
      );
      setIntervals(next);
    });
  }

  function refreshOpenSlots(nextFieldId: string) {
    const key = `${nextFieldId}|${match.seasonId}|${match.id}`;
    if (!nextFieldId) {
      setOpenSlots(emptyOpenSlots);
      setOpenSlotsKey("");
      return;
    }
    setOpenSlotsKey(key);
    startOpenSlots(async () => {
      const next = await loadFieldOpenSlotsAction({
        organizationId,
        fieldId: nextFieldId,
        seasonId: match.seasonId,
        excludeMatchId: match.id,
        excludeReservationId: match.schedule.reservationId,
        slotMinutes: details.slotMinutes,
      });
      setOpenSlots(next);
    });
  }

  useEffect(() => {
    if (effectiveFieldId) {
      refreshOpenSlots(effectiveFieldId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveFieldId, match.id, match.seasonId, details.slotMinutes]);

  useEffect(() => {
    if (scheduleState.ok === false && scheduleState.message) {
      refreshOpenSlots(effectiveFieldId);
      if (date) {
        refreshAvailability(effectiveFieldId, date);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleState.message, scheduleState.ok]);

  const endPreview = addMinutesToLocalPreview(
    date,
    time,
    details.slotMinutes
  );

  const detailHref = `/organizaciones/${organizationId}/torneos/${details.competitionId}/temporadas/${match.seasonId}/partidos/${match.id}`;
  const fieldConfigHref = effectiveFieldId
    ? `/organizaciones/${organizationId}/canchas/${effectiveFieldId}`
    : `/organizaciones/${organizationId}/canchas`;

  const showSuggestedSlots =
    openSlotsKey === `${effectiveFieldId}|${match.seasonId}|${match.id}`;

  function applySuggestedSlot(slot: FieldOpenSlot) {
    setDate(slot.date);
    setTime(slot.startsAt);
    refreshAvailability(effectiveFieldId, slot.date);
  }

  if (!canManage) {
    return (
      <Card>
        <p className="text-sm text-text-secondary">
          Solo owner/admin pueden programar partidos.
        </p>
        <Link href={detailHref} className="mt-3 inline-flex text-sm underline">
          Volver al partido
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        {(scheduleState.message || unscheduleState.message) && (
          <p
            className={cn(
              "rounded-xl border px-3 py-2 text-sm",
              scheduleState.ok || unscheduleState.ok
                ? "border-success/40 bg-success/10 text-success"
                : "border-danger/40 bg-danger/10 text-danger"
            )}
            role="alert"
          >
            {scheduleState.message || unscheduleState.message}
          </p>
        )}

        <form action={scheduleAction} className="space-y-4">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input
            type="hidden"
            name="competitionId"
            value={details.competitionId}
          />
          <input type="hidden" name="seasonId" value={match.seasonId} />
          <input type="hidden" name="matchId" value={match.id} />

          <div className="space-y-1.5">
            <label htmlFor="fieldId" className="text-sm font-medium">
              Cancha
            </label>
            <select
              id="fieldId"
              name="fieldId"
              value={effectiveFieldId}
              onChange={(e) => {
                const next = e.target.value;
                setFieldId(next);
                refreshOpenSlots(next);
                refreshAvailability(next, date);
              }}
              disabled={schedulePending || fields.length === 0}
              className="min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm"
            >
              {fields.length === 0 && (
                <option value="">Sin canchas activas</option>
              )}
              {fields.map((field) => (
                <option key={field.id} value={field.id}>
                  {fieldSchedulingLabel(field)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-text-primary">
              Horarios sugeridos
            </p>
            {!effectiveFieldId ? (
              <p className="text-sm text-text-secondary">
                Elige una cancha para ver horarios libres.
              </p>
            ) : openSlotsPending || !showSuggestedSlots ? (
              <p className="text-sm text-text-secondary">
                Buscando horarios libres…
              </p>
            ) : !openSlots.hasWeeklyAvailability ? (
              <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-text-secondary">
                <p>
                  Esta cancha no tiene horarios disponibles configurados.
                </p>
                <Link
                  href={fieldConfigHref}
                  className="mt-2 inline-flex font-medium text-organization-accent underline-offset-2 hover:underline"
                >
                  Configurar disponibilidad de la cancha
                </Link>
              </div>
            ) : openSlots.slots.length === 0 ? (
              <p className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-text-secondary">
                No hay horarios libres en las próximas semanas con la duración
                de este torneo ({details.slotMinutes} min). Prueba otra cancha o
                escribe fecha y hora manualmente.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {openSlots.slots.map((slot) => {
                  const selected =
                    date === slot.date && time === slot.startsAt;
                  return (
                    <li key={`${slot.date}-${slot.startsAt}`}>
                      <button
                        type="button"
                        onClick={() => applySuggestedSlot(slot)}
                        className={cn(
                          "min-h-11 w-full rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                          selected
                            ? "border-organization-accent bg-organization-accent/10 text-text-primary"
                            : "border-border bg-surface text-text-secondary hover:border-organization-accent/50 hover:bg-surface-elevated"
                        )}
                      >
                        {formatOpenSlotLabel(slot)}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="date" className="text-sm font-medium">
                Fecha
              </label>
              <input
                id="date"
                name="date"
                type="date"
                value={date}
                onChange={(e) => {
                  const next = e.target.value;
                  setDate(next);
                  refreshAvailability(effectiveFieldId, next);
                }}
                required
                disabled={schedulePending}
                className="min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="time" className="text-sm font-medium">
                Hora inicio
              </label>
              <input
                id="time"
                name="time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                disabled={schedulePending}
                className="min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm"
              />
            </div>
          </div>

          <FieldAvailabilitySummary
            intervals={
              availKey === `${effectiveFieldId}|${date}` ? intervals : []
            }
            emptyMessage={
              !effectiveFieldId || !date
                ? "Elige cancha y fecha para ver disponibilidad del día."
                : availPending
                  ? "Cargando disponibilidad…"
                  : "Sin horario habitual configurado para este día."
            }
          />

          <p className="text-sm text-text-secondary">
            Duración del slot: {details.slotMinutes} min (partido{" "}
            {details.matchDurationMinutes}
            {details.minimumRestMinutes
              ? ` + descanso ${details.minimumRestMinutes}`
              : ""}
            ). Hora final estimada:{" "}
            <span className="font-medium text-text-primary">{endPreview}</span>
          </p>

          <SubmitButton
            pending={schedulePending}
            disabled={!effectiveFieldId || !date || !time}
          >
            {match.isProgrammed ? "Reprogramar partido" : "Programar partido"}
          </SubmitButton>
        </form>
      </Card>

      {match.isProgrammed && match.status === "scheduled" && (
        <Card>
          <form action={unscheduleAction} className="space-y-3">
            <input type="hidden" name="organizationId" value={organizationId} />
            <input
              type="hidden"
              name="competitionId"
              value={details.competitionId}
            />
            <input type="hidden" name="seasonId" value={match.seasonId} />
            <input type="hidden" name="matchId" value={match.id} />
            <p className="text-sm text-text-secondary">
              Dejar el partido pendiente cancela la reserva de cancha sin borrar
              el partido.
            </p>
            <SubmitButton
              pending={unschedulePending}
              className="border border-border bg-transparent text-text-primary"
            >
              Dejar pendiente
            </SubmitButton>
          </form>
        </Card>
      )}

      <Link href={detailHref} className="inline-flex text-sm underline">
        Volver al detalle
      </Link>
    </div>
  );
}
