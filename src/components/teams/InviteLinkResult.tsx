type InviteLinkResultProps = {
  inviteUrl?: string | null;
  whatsAppHref?: string | null;
};

export function InviteLinkResult({
  inviteUrl,
  whatsAppHref,
}: InviteLinkResultProps) {
  if (!inviteUrl) return null;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-background/40 p-3">
      <p className="text-sm font-medium text-text-primary">
        Enlace de invitación
      </p>
      <p className="break-all text-sm text-text-secondary">{inviteUrl}</p>
      <div className="flex flex-wrap gap-2">
        <a
          href={inviteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center rounded-xl border border-border px-3 text-sm font-medium"
        >
          Abrir invitación
        </a>
        {whatsAppHref && (
          <a
            href={whatsAppHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center rounded-xl bg-[#25D366] px-3 text-sm font-semibold text-white"
          >
            Enviar por WhatsApp
          </a>
        )}
      </div>
      {!whatsAppHref && (
        <p className="text-xs text-muted">
          Agrega un teléfono en el formulario para generar el enlace de WhatsApp.
        </p>
      )}
    </div>
  );
}
