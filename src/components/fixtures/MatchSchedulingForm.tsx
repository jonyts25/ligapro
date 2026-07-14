"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  scheduleMatchAction,
  unscheduleMatchAction,
} from "@/lib/fixtures/actions";
import { loadFieldAvailabilityAction } from "@/lib/fixtures/availability-action";
import { addMinutesToLocalPreview } from "@/lib/fixtures/format";
import {
  initialFixtureActionState,
  type ActiveFieldOption,
  type ActiveVenueOption,
  type MatchSchedulingDetails,
} from "@/lib/fixtures/types";
import { FieldAvailabilitySummary } from "@/components/fixtures/FieldAvailabilitySummary";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";

type MatchSchedulingFormProps = {
  details: MatchSchedulingDetails;
  venues: ActiveVenueOption[];
  fields: ActiveFieldOption[];
  organizationId: string;
  canManage: boolean;
};

export function MatchSchedulingForm({
  details,
  venues,
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

  const [venueId, setVenueId] = useState(
    () =>
      scheduleState.values?.venueId ||
      match.schedule.venueId ||
      venues[0]?.id ||
      ""
  );
  const [fieldId, setFieldId] = useState(
    () =>
      scheduleState.values?.fieldId || match.schedule.fieldId || ""
  );
  const [date, setDate] = useState(() => scheduleState.values?.date || "");
  const [time, setTime] = useState(() => scheduleState.values?.time || "");
  const [intervals, setIntervals] = useState<
    Array<{ startsAt: string; endsAt: string }>
  >([]);
  const [availPending, startAvail] = useTransition();
  const [availKey, setAvailKey] = useState("");

  const fieldsForVenue = useMemo(
    () => fields.filter((f) => f.venueId === venueId),
    [fields, venueId]
  );

  const effectiveFieldId = fieldsForVenue.some((f) => f.id === fieldId)
    ? fieldId
    : (fieldsForVenue[0]?.id ?? "");

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

  const endPreview = addMinutesToLocalPreview(
    date,
    time,
    details.slotMinutes
  );

  const detailHref = `/organizaciones/${organizationId}/torneos/${details.competitionId}/temporadas/${match.seasonId}/partidos/${match.id}`;

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
          <input type="hidden" name="venueId" value={venueId} />

          <div className="space-y-1.5">
            <label htmlFor="venueIdSelect" className="text-sm font-medium">
              Sede
            </label>
            <select
              id="venueIdSelect"
              value={venueId}
              onChange={(e) => {
                const nextVenue = e.target.value;
                setVenueId(nextVenue);
                const nextFields = fields.filter((f) => f.venueId === nextVenue);
                const nextField = nextFields[0]?.id ?? "";
                setFieldId(nextField);
                refreshAvailability(nextField, date);
              }}
              disabled={schedulePending}
              className="min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm"
            >
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

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
                refreshAvailability(next, date);
              }}
              disabled={schedulePending || fieldsForVenue.length === 0}
              className="min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm"
            >
              {fieldsForVenue.length === 0 && (
                <option value="">Sin canchas activas</option>
              )}
              {fieldsForVenue.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
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
                ? "Elige cancha y fecha para ver disponibilidad."
                : availPending
                  ? "Cargando disponibilidad…"
                  : "Configura primero la disponibilidad habitual de esta cancha."
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
            disabled={
              !effectiveFieldId ||
              !date ||
              !time ||
              (availKey === `${effectiveFieldId}|${date}` &&
                intervals.length === 0)
            }
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
