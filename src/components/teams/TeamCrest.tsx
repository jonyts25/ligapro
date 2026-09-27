import { teamInitials } from "@/lib/teams/team-initials";
import { cn } from "@/lib/utils/cn";

type TeamCrestProps = {
  name: string;
  logoUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses = {
  sm: "h-8 w-8 text-[10px]",
  md: "h-10 w-10 text-xs",
  lg: "h-14 w-14 text-sm",
} as const;

export function TeamCrest({
  name,
  logoUrl,
  size = "md",
  className,
}: TeamCrestProps) {
  const initials = teamInitials(name);

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-elevated font-semibold text-text-secondary",
        sizeClasses[size],
        className
      )}
      aria-hidden={logoUrl ? undefined : true}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
