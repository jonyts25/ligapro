const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: FormDataEntryValue | null): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

export function getSafeInternalPath(
  candidate: string | null | undefined,
  allowed: readonly string[]
): string | null {
  if (!candidate) return null;
  if (!candidate.startsWith("/")) return null;
  if (candidate.startsWith("//")) return null;
  if (candidate.includes("://")) return null;
  if (candidate.toLowerCase().startsWith("javascript:")) return null;
  if (!allowed.includes(candidate)) return null;
  return candidate;
}

export const AUTH_CALLBACK_ALLOWED_NEXT = [
  "/",
  "/onboarding",
  "/actualizar-contrasena",
  "/seleccionar-organizacion",
] as const;

export function roleLabel(role: string): string {
  switch (role) {
    case "organization_owner":
      return "Propietario";
    case "organization_admin":
      return "Administrador";
    case "organization_member":
      return "Miembro";
    default:
      return role;
  }
}

export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}
