type AuthDividerProps = {
  label?: string;
};

export function AuthDivider({ label = "o continúa con" }: AuthDividerProps) {
  return (
    <div className="relative py-1">
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center text-xs uppercase tracking-wide">
        <span className="bg-surface px-2 text-muted">{label}</span>
      </div>
    </div>
  );
}
