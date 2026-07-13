"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { resolveAuthDestination } from "@/lib/auth/resolve-auth-destination";
import type { AuthActionState } from "@/lib/auth/types";
import {
  AUTH_CALLBACK_ALLOWED_NEXT,
  getSafeInternalPath,
  isValidEmail,
  normalizeEmail,
} from "@/lib/auth/validation";

async function getSiteOrigin(): Promise<string> {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  if (host) {
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function signInAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const nextCandidate = String(formData.get("next") ?? "");

  if (!isValidEmail(email) || password.length < 1) {
    return {
      ok: false,
      message:
        "No pudimos iniciar sesión. Revisa tus datos e inténtalo nuevamente.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return {
      ok: false,
      message:
        "No pudimos iniciar sesión. Revisa tus datos e inténtalo nuevamente.",
    };
  }

  const safeNext = getSafeInternalPath(
    nextCandidate,
    AUTH_CALLBACK_ALLOWED_NEXT
  );
  if (safeNext && safeNext !== "/") {
    redirect(safeNext);
  }

  const destination = await resolveAuthDestination(data.user.id);
  redirect(destination);
}

export async function signUpAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const accepted = formData.get("acceptTerms") === "on";

  const fieldErrors: Record<string, string> = {};

  if (!displayName) {
    fieldErrors.displayName = "El nombre es obligatorio.";
  }
  if (!isValidEmail(email)) {
    fieldErrors.email = "Ingresa un correo válido.";
  }
  if (password.length < 8) {
    fieldErrors.password = "La contraseña debe tener al menos 8 caracteres.";
  }
  if (password !== confirmPassword) {
    fieldErrors.confirmPassword = "Las contraseñas no coinciden.";
  }
  if (!accepted) {
    fieldErrors.acceptTerms = "Debes aceptar los términos para continuar.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      message: "Revisa los datos del formulario.",
      fieldErrors,
    };
  }

  const origin = await getSiteOrigin();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
        full_name: displayName,
      },
      emailRedirectTo: `${origin}/auth/callback?next=/onboarding`,
    },
  });

  if (error) {
    return {
      ok: false,
      message:
        "No pudimos completar el registro. Inténtalo nuevamente más tarde.",
    };
  }

  // If email confirmation is required, session is null.
  if (!data.session) {
    redirect(
      `/confirmar-correo?email=${encodeURIComponent(maskForQuery(email))}`
    );
  }

  if (!data.user) {
    return {
      ok: false,
      message:
        "No pudimos completar el registro. Inténtalo nuevamente más tarde.",
    };
  }

  const destination = await resolveAuthDestination(data.user.id);
  redirect(destination);
}

function maskForQuery(email: string): string {
  // Only pass the email for display masking on confirm page; not a secret.
  return email;
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/iniciar-sesion");
}

export async function requestPasswordResetAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = normalizeEmail(formData.get("email"));

  if (!isValidEmail(email)) {
    return {
      ok: true,
      message:
        "Si existe una cuenta asociada, recibirás instrucciones por correo.",
    };
  }

  const origin = await getSiteOrigin();
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/actualizar-contrasena`,
  });

  return {
    ok: true,
    message:
      "Si existe una cuenta asociada, recibirás instrucciones por correo.",
  };
}

export async function updatePasswordAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) {
    return {
      ok: false,
      message: "La contraseña debe tener al menos 8 caracteres.",
      fieldErrors: {
        password: "La contraseña debe tener al menos 8 caracteres.",
      },
    };
  }

  if (password !== confirmPassword) {
    return {
      ok: false,
      message: "Las contraseñas no coinciden.",
      fieldErrors: {
        confirmPassword: "Las contraseñas no coinciden.",
      },
    };
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    return {
      ok: false,
      message:
        "El enlace de recuperación no es válido o expiró. Solicita uno nuevo.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return {
      ok: false,
      message:
        "No pudimos actualizar la contraseña. Solicita un nuevo enlace e inténtalo otra vez.",
    };
  }

  await supabase.auth.signOut();
  redirect(
    "/iniciar-sesion?message=" +
      encodeURIComponent(
        "Tu contraseña fue actualizada. Inicia sesión nuevamente."
      )
  );
}
