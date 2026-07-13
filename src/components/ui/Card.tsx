import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type CardProps = {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
};

export function Card({ children, className, as: Tag = "div" }: CardProps) {
  return (
    <Tag
      className={cn(
        "rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5",
        className
      )}
    >
      {children}
    </Tag>
  );
}
