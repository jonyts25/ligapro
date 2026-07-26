import { cn } from "@/lib/utils/cn";

type PlayerAvatarProps = {
  photoUrl: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClass = {
  sm: "h-10 w-10",
  md: "h-14 w-14",
  lg: "h-32 w-32",
} as const;

export function PlayerAvatar({
  photoUrl,
  name,
  size = "md",
  className,
}: PlayerAvatarProps) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface-elevated",
        sizeClass[size],
        className
      )}
      aria-hidden={photoUrl ? undefined : true}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span
          className={cn(
            "font-semibold text-muted",
            size === "lg" ? "text-2xl" : size === "md" ? "text-sm" : "text-xs"
          )}
        >
          {initials || "?"}
        </span>
      )}
    </div>
  );
}
