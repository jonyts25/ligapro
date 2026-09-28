/**
 * Pure WhatsApp deep-link helpers (web + mobile).
 */

export function buildCaptainWhatsAppLink(
  phone: string,
  message: string
): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function buildMatchCaptainContactMessage(params: {
  teamName: string;
  opponentName: string;
  isOwnHome: boolean;
}): string {
  const prefix = params.isOwnHome ? "vs" : "@";
  return `Hola, soy capitán de ${params.teamName}. Te escribo por nuestro partido ${prefix} ${params.opponentName}.`;
}

export function buildPlayerClaimWhatsAppMessage(params: {
  teamLabel: string;
  inviteUrl: string;
  platformName?: string;
}): string {
  const platform = params.platformName ?? "Ligera";
  return `Hola, te invitamos a reclamar tu perfil de jugador en ${params.teamLabel} (${platform}). Acepta aquí: ${params.inviteUrl}`;
}
