import { TEAM_LOGO_BUCKET } from "@/lib/teams/logo-constants";

export function getTeamLogoPublicUrl(
  logoPath: string | null | undefined
): string | null {
  if (!logoPath) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/${TEAM_LOGO_BUCKET}/${logoPath}`;
}
