/**
 * Redacts a stored player full_name for public youth competition pages.
 * Format: first given name + initial of first surname (second token).
 * Example: "Juan Pérez García" → "Juan P."
 */
export function redactPlayerNameForPublic(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return trimmed;

  const parts = trimmed.split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? "";
  if (parts.length < 2) return firstName;

  const surnameInitial = parts[1]?.charAt(0).toUpperCase();
  if (!surnameInitial) return firstName;

  return `${firstName} ${surnameInitial}.`;
}
