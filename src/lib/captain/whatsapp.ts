/**
 * Builds a WhatsApp deep-link for notifying the opponent captain.
 * Phone must be E.164 digits only (no +).
 */
export function buildCaptainWhatsAppLink(
  phone: string,
  message: string
): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function buildRescheduleWhatsAppMessage(params: {
  teamName: string;
  opponentName: string;
  proposedDateTimeLabel: string;
  venueLabel?: string | null;
}): string {
  const venue = params.venueLabel ? ` en ${params.venueLabel}` : "";
  return `Hola, soy capitán de ${params.teamName}. Propongo reagendar nuestro partido vs ${params.opponentName} para ${params.proposedDateTimeLabel}${venue}. ¿Te funciona?`;
}
