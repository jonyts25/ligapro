import { localMexicoCityToTimestamptz } from "@/lib/fixtures/timezone";
import {
  isNonMatchReservationType,
  type NonMatchReservationType,
} from "@/lib/venues/reservation-types";

export type CreateFieldReservationInput = {
  organizationId: string;
  fieldId: string;
  reservationType: string;
  date: string;
  startTime: string;
  endTime: string;
  title?: string | null;
};

export type ReservationValidationResult =
  | {
      ok: true;
      startsAt: string;
      endsAt: string;
      reservationType: NonMatchReservationType;
      title: string | null;
    }
  | {
      ok: false;
      message: string;
      fieldErrors?: Record<string, string>;
    };

export function validateCreateFieldReservationInput(
  input: CreateFieldReservationInput
): ReservationValidationResult {
  const fieldErrors: Record<string, string> = {};

  if (!input.organizationId.trim()) {
    return { ok: false, message: "Organización requerida." };
  }

  if (!input.fieldId.trim()) {
    fieldErrors.fieldId = "Selecciona una cancha.";
  }

  if (input.reservationType === "match") {
    return {
      ok: false,
      message: "Esta pantalla no crea reservas de partido.",
    };
  }

  if (!isNonMatchReservationType(input.reservationType)) {
    fieldErrors.reservationType = "Selecciona un tipo de reserva válido.";
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    fieldErrors.date = "Fecha inválida.";
  }

  if (!/^\d{2}:\d{2}$/.test(input.startTime)) {
    fieldErrors.startTime = "Hora de inicio inválida.";
  }

  if (!/^\d{2}:\d{2}$/.test(input.endTime)) {
    fieldErrors.endTime = "Hora de fin inválida.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      message: "Revisa los campos marcados.",
      fieldErrors,
    };
  }

  const startsAt = localMexicoCityToTimestamptz(input.date, input.startTime);
  const endsAt = localMexicoCityToTimestamptz(input.date, input.endTime);

  if (!startsAt || !endsAt) {
    return {
      ok: false,
      message: "No se pudo interpretar la fecha u horario.",
    };
  }

  if (new Date(endsAt) <= new Date(startsAt)) {
    return {
      ok: false,
      message: "La hora de fin debe ser posterior a la de inicio.",
      fieldErrors: {
        endTime: "Debe ser posterior a la hora de inicio.",
      },
    };
  }

  const title = input.title?.trim() ? input.title.trim().slice(0, 200) : null;

  return {
    ok: true,
    startsAt,
    endsAt,
    reservationType: input.reservationType as NonMatchReservationType,
    title,
  };
}

export function validateCancelFieldReservation(
  reservation: { reservation_type: string; status: string } | null
): { ok: true } | { ok: false; message: string } {
  if (!reservation) {
    return { ok: false, message: "Reserva no encontrada." };
  }

  if (reservation.reservation_type === "match") {
    return {
      ok: false,
      message:
        "Los partidos se reprograman o cancelan desde su propia pantalla.",
    };
  }

  if (reservation.status !== "confirmed") {
    return { ok: false, message: "Esta reserva ya no está activa." };
  }

  return { ok: true };
}
