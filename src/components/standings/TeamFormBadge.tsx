import { cn } from "@/lib/utils/cn";

type TeamFormBadgeProps = {
  recentForm: string;
  className?: string;
};

const LETTER_STYLES: Record<string, string> = {
  G: "bg-success/20 text-success",
  E: "bg-surface-elevated text-text-secondary",
  P: "bg-danger/20 text-danger",
};

export function TeamFormBadge({ recentForm, className }: TeamFormBadgeProps) {
  const letters = (recentForm || "").split("").filter(Boolean);
  if (letters.length === 0) {
    return <span className="text-xs text-muted">—</span>;
  }

  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      title="Últimos resultados (G ganó · E empató · P perdió)"
      aria-label={`Forma reciente: ${letters.join(" ")}`}
    >
      {letters.map((letter, index) => (
        <span
          key={`${letter}-${index}`}
          className={cn(
            "inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold",
            LETTER_STYLES[letter] ?? "bg-surface-elevated text-muted"
          )}
        >
          {letter}
        </span>
      ))}
    </span>
  );
}
