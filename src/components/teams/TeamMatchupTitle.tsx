import { TeamCrest } from "@/components/teams/TeamCrest";
import { cn } from "@/lib/utils/cn";

type TeamMatchupTitleProps = {
  homeName: string;
  awayName: string;
  homeLogoUrl?: string | null;
  awayLogoUrl?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  className?: string;
  titleClassName?: string;
  as?: "h1" | "p" | "span";
};

export function TeamMatchupTitle({
  homeName,
  awayName,
  homeLogoUrl,
  awayLogoUrl,
  homeScore,
  awayScore,
  className,
  titleClassName,
  as: Tag = "p",
}: TeamMatchupTitleProps) {
  const hasScore = homeScore != null && awayScore != null;
  const scoreText = hasScore ? `${homeScore}–${awayScore}` : "vs";

  return (
    <Tag
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-text-primary",
        titleClassName
      )}
    >
      <span className={cn("inline-flex items-center gap-2", className)}>
        <TeamCrest name={homeName} logoUrl={homeLogoUrl} size="sm" />
        <span>{homeName}</span>
      </span>
      <span className="font-normal text-muted">{scoreText}</span>
      <span className={cn("inline-flex items-center gap-2", className)}>
        <TeamCrest name={awayName} logoUrl={awayLogoUrl} size="sm" />
        <span>{awayName}</span>
      </span>
    </Tag>
  );
}
