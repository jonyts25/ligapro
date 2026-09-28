export {
  buildCaptainWhatsAppLink,
  buildMatchCaptainContactMessage,
  buildPlayerClaimWhatsAppMessage,
} from "../shared/captain-whatsapp";

export function buildAdminRosterContactMessage(competitionName: string): string {
  return `Hola, soy el administrador de ${competitionName}. Te contacto por tu participación en el torneo.`;
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
