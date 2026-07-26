"use client";

import { useActionState } from "react";
import Link from "next/link";
import { acceptCaptainInvitationAction } from "@/lib/captain/actions";
import type { CaptainInvitationPreview } from "@/lib/captain/types";
import { initialCaptainActionState } from "@/lib/captain/types";
import { maskEmail } from "@/lib/auth/validation";
import { AuthCard } from "@/components/auth/AuthCard";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

type CaptainInvitationAcceptPanelProps = {
  token: string;
  preview: CaptainInvitationPreview | null;
  reason: "invalid" | "email_mismatch" | "ok" | "login_required";
  userEmail?: string | null;
  isAuthenticated: boolean;
};

export function CaptainInvitationAcceptPanel({
  token,
  preview,
  reason,
  userEmail,
  isAuthenticated,
}: CaptainInvitationAcceptPanelProps) {
  const [state, action, pending] = useActionState(
    acceptCaptainInvitationAction,
    initialCaptainActionState
  );

  const loginNext = `/invitacion/${token}`;
  const registerHref = `/registro?next=${encodeURIComponent(loginNext)}`;
  const loginHref = `/iniciar-sesion?next=${encodeURIComponent(loginNext)}`;

  if (reason === "invalid") {
    return (
      <AuthCard
        title="Invitación no válida"
        description="Este enlace no corresponde a una invitación activa."
      >
        <p className="text-sm text-text-secondary">
          Puede haber expirado, ya haberse usado o contener un error. Pide a tu
          liga que reenvíe la invitación.
        </p>
        <p className="mt-4 text-sm">
          <Link href="/iniciar-sesion" className="font-medium text-brand">
            Ir a iniciar sesión
          </Link>
        </p>
      </AuthCard>
    );
  }

  if (reason === "login_required") {
    return (
      <AuthCard
        title="Invitación de capitán"
        description="Inicia sesión o crea cuenta con el correo al que llegó la invitación."
      >
        <div className="space-y-3">
          <Link
            href={loginHref}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
          >
            Iniciar sesión
          </Link>
          <Link
            href={registerHref}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-border px-4 text-sm font-medium"
          >
            Crear cuenta
          </Link>
          <GoogleSignInButton next={loginNext} />
        </div>
      </AuthCard>
    );
  }

  if (reason === "email_mismatch") {
    return (
      <AuthCard
        title="Correo distinto"
        description="La sesión actual no coincide con la invitación."
      >
        <p className="text-sm text-text-secondary">
          Estás conectado como {maskEmail(userEmail)}. Cierra sesión e ingresa
          con el correo invitado.
        </p>
        <p className="mt-4 text-sm">
          <Link href={loginHref} className="font-medium text-brand">
            Cambiar cuenta
          </Link>
        </p>
      </AuthCard>
    );
  }

  if (!preview) {
    return null;
  }

  if (preview.isExpired || preview.status === "expired") {
    return (
      <AuthCard title="Invitación expirada" description="Este enlace ya no está activo.">
        <p className="text-sm text-text-secondary">
          La invitación venció el{" "}
          {new Intl.DateTimeFormat("es-MX", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(preview.expiresAt))}
          . Pide a {preview.organizationName ?? "tu liga"} una nueva invitación.
        </p>
      </AuthCard>
    );
  }

  if (preview.status === "accepted") {
    return (
      <AuthCard title="Invitación ya utilizada" description="Este enlace ya fue aceptado.">
        <p className="text-sm text-text-secondary">
          Tu cuenta ya está vinculada. Entra al portal de tu equipo.
        </p>
        <Link
          href="/mi-equipo"
          className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
        >
          Ir a mi equipo
        </Link>
      </AuthCard>
    );
  }

  if (preview.status !== "pending") {
    return (
      <AuthCard
        title="Invitación no disponible"
        description={`Estado: ${preview.status}`}
      >
        <p className="text-sm text-text-secondary">
          Contacta a tu liga para obtener una nueva invitación.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Aceptar invitación"
      description={
        preview.organizationName
          ? `${preview.organizationName}${preview.teamName ? ` · ${preview.teamName}` : ""}`
          : "Vincula tu cuenta como capitán o vicecapitán."
      }
    >
      <dl className="mb-4 space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-text-secondary">Correo invitado</dt>
          <dd>{maskEmail(preview.email)}</dd>
        </div>
        {preview.seasonName && (
          <div className="flex justify-between gap-3">
            <dt className="text-text-secondary">Temporada</dt>
            <dd>{preview.seasonName}</dd>
          </div>
        )}
      </dl>

      {!isAuthenticated ? (
        <div className="space-y-3">
          <Link
            href={loginHref}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
          >
            Iniciar sesión para aceptar
          </Link>
          <Link
            href={registerHref}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-border px-4 text-sm font-medium"
          >
            Crear cuenta
          </Link>
        </div>
      ) : (
        <form action={action} className="space-y-3">
          {state.message && (
            <p
              className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
              role="alert"
            >
              {state.message}
            </p>
          )}
          <input type="hidden" name="token" value={token} />
          <SubmitButton pending={pending}>Aceptar invitación</SubmitButton>
        </form>
      )}
    </AuthCard>
  );
}
