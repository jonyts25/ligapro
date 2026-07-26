export function humanizeCaptainInvitationError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invitation not found")) {
    return "Esta invitación no es válida. Verifica el enlace o pide una nueva invitación a tu liga.";
  }
  if (lower.includes("no longer pending")) {
    return "Esta invitación ya fue utilizada.";
  }
  if (lower.includes("has expired")) {
    return "Esta invitación expiró. Pide a tu liga que envíe una nueva.";
  }
  if (lower.includes("email does not match")) {
    return "El correo de tu cuenta no coincide con el de la invitación. Inicia sesión con el correo invitado.";
  }
  if (lower.includes("not authenticated")) {
    return "Debes iniciar sesión para aceptar la invitación.";
  }
  return "No pudimos procesar la invitación. Inténtalo nuevamente.";
}

export function humanizeCaptainRescheduleError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("not authorized")) {
    return "No tienes permiso para reagendar este partido.";
  }
  if (lower.includes("open reschedule request already exists")) {
    return "Ya hay una solicitud de reagendado abierta para este partido.";
  }
  if (lower.includes("match not found")) {
    return "Partido no encontrado.";
  }
  if (lower.includes("cannot approve own")) {
    return "No puedes responder a tu propia propuesta.";
  }
  return "No pudimos procesar el reagendado. Revisa los datos e inténtalo otra vez.";
}

export function humanizeCaptainPaymentMarkError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("not authorized")) {
    return "No tienes permiso para marcar pagos en este plantel.";
  }
  return "No pudimos actualizar la marca de pago.";
}
