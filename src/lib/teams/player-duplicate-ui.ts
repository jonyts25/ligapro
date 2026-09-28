export type PotentialDuplicatePlayer = {
  playerId: string;
  fullName: string;
  isClaimed: boolean;
  teamsCount: number;
};

export function normalizePlayerPhoneForSearch(phone: string): string | null {
  const trimmed = phone.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function shouldPromptDuplicateConfirmation(
  phone: string,
  duplicates: PotentialDuplicatePlayer[]
): boolean {
  return (
    normalizePlayerPhoneForSearch(phone) !== null && duplicates.length > 0
  );
}

export function duplicateConfirmationMessage(
  duplicate: PotentialDuplicatePlayer
): string {
  const teamsLabel =
    duplicate.teamsCount === 1
      ? "1 equipo"
      : `${duplicate.teamsCount} equipos`;
  const claimedLabel = duplicate.isClaimed
    ? "Perfil ya reclamado"
    : "Sin perfil reclamado aún";
  return `${duplicate.fullName} · Ya juega en ${teamsLabel} aquí · ${claimedLabel}`;
}
