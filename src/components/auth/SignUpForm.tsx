"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  signUpAction,
} from "@/lib/auth/actions";
import { initialAuthActionState } from "@/lib/auth/action-state";
import { AuthCard } from "@/components/auth/AuthCard";
import { TextField } from "@/components/auth/TextField";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { SubmitButton } from "@/components/auth/SubmitButton";

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(
    signUpAction,
    initialAuthActionState
  );

  return (
    <AuthCard
      title="Crear cuenta"
      description="Regístrate para administrar tu liga amateur."
    >
      {state.message && (
        <p
          className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
          role="alert"
        >
          {state.message}
        </p>
      )}

      <form action={formAction} className="space-y-4">
        <TextField
          id="displayName"
          name="displayName"
          label="Nombre"
          autoComplete="name"
          required
          disabled={pending}
          error={state.fieldErrors?.displayName}
        />
        <TextField
          id="email"
          name="email"
          label="Correo"
          type="email"
          autoComplete="email"
          required
          disabled={pending}
          error={state.fieldErrors?.email}
        />
        <PasswordInput
          id="password"
          name="password"
          label="Contraseña"
          autoComplete="new-password"
          required
          disabled={pending}
          error={state.fieldErrors?.password}
        />
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          label="Confirmar contraseña"
          autoComplete="new-password"
          required
          disabled={pending}
          error={state.fieldErrors?.confirmPassword}
        />

        <div className="space-y-1.5">
          <label className="flex items-start gap-3 text-sm text-text-secondary">
            <input
              type="checkbox"
              name="acceptTerms"
              className="mt-1 h-4 w-4 rounded border-border"
              disabled={pending}
              required
            />
            <span>
              Acepto los términos y el aviso de privacidad.
              <span className="mt-1 block text-xs text-muted">
                Los documentos legales se publicarán en un bloque posterior.
              </span>
            </span>
          </label>
          {state.fieldErrors?.acceptTerms && (
            <p className="text-xs text-danger" role="alert">
              {state.fieldErrors.acceptTerms}
            </p>
          )}
        </div>

        <SubmitButton pending={pending}>Crear cuenta</SubmitButton>
      </form>

      <p className="mt-5 text-sm text-text-secondary">
        ¿Ya tienes cuenta?{" "}
        <Link
          href="/iniciar-sesion"
          className="font-medium text-organization-accent hover:underline"
        >
          Iniciar sesión
        </Link>
      </p>
    </AuthCard>
  );
}
