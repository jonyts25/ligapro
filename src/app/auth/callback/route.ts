import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveAuthDestination } from "@/lib/auth/resolve-auth-destination";
import {
  AUTH_CALLBACK_ALLOWED_NEXT,
  getSafeInternalPath,
} from "@/lib/auth/validation";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  const safeNext = getSafeInternalPath(nextParam, AUTH_CALLBACK_ALLOWED_NEXT);

  if (!code) {
    return NextResponse.redirect(
      `${origin}/iniciar-sesion?message=${encodeURIComponent(
        "No pudimos completar la verificación. Intenta iniciar sesión."
      )}`
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(
      `${origin}/iniciar-sesion?message=${encodeURIComponent(
        "No pudimos completar la verificación. Intenta iniciar sesión."
      )}`
    );
  }

  if (safeNext) {
    return NextResponse.redirect(`${origin}${safeNext}`);
  }

  const destination = await resolveAuthDestination(data.user.id);
  return NextResponse.redirect(`${origin}${destination}`);
}
