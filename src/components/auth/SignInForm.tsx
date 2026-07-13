"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  signInAction,
} from "@/lib/auth/actions";
import { initialAuthActionState } from "@/lib/auth/action-state";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthDivider } from "@/components/auth/AuthDivider";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { TextField } from "@/components/auth/TextField";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { SubmitButton } from "@/components/auth/SubmitButton";

type SignInFormProps = {
  next?: string;
  message?: string;
};

export function SignInForm({ next, message }: SignInFormProps) {
  const [state, formAction, pending] = useActionState(
    signInAction,
    initialAuthActionState
  );

  return (
    <AuthCard
      title="Iniciar sesión"
      description="Accede al panel operativo de tu liga."
    >
      {(message || state.message) && (
        <p
          className={`mb-4 rounded-xl border px-3 py-2 text-sm ${
            state.ok || message
              ? "border-border bg-surface-elevated text-text-secondary"
              : "border-danger/40 bg-danger/10 text-danger"
          }`}
          role="alert"
        >
          {state.message ?? message}
        </p>
      )}

      <form action={formAction} className="space-y-4">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <TextField
          id="email"
          name="email"
          label="Correo"
          type="email"
          autoComplete="email"
          required
          disabled={pending}
        />
        <PasswordInput
          id="password"
          name="password"
          label="Contraseña"
          autoComplete="current-password"
          required
          disabled={pending}
        />
        <SubmitButton pending={pending}>Entrar</SubmitButton>
      </form>

      <div className="mt-5 space-y-3">
        <AuthDivider />
        <GoogleSignInButton next={next} disabled={pending} />
      </div>

      <div className="mt-5 space-y-2 text-sm text-text-secondary">
        <p>
          <Link
            href="/recuperar-contrasena"
            className="font-medium text-organization-accent hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </p>
        <p>
          ¿No tienes cuenta?{" "}
          <Link
            href="/registro"
            className="font-medium text-organization-accent hover:underline"
          >
            Crear cuenta
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}
