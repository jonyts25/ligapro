"use client";

import Link from "next/link";
import { cn } from "@/lib/utils/cn";

type TierLimitLinkProps = {
  href: string;
  disabled?: boolean;
  disabledReason?: string | null;
  className?: string;
  children: React.ReactNode;
};

export function TierLimitLink({
  href,
  disabled = false,
  disabledReason,
  className,
  children,
}: TierLimitLinkProps) {
  if (disabled) {
    return (
      <span
        title={disabledReason ?? undefined}
        className={cn(
          className,
          "cursor-not-allowed opacity-50"
        )}
        aria-disabled="true"
      >
        {children}
      </span>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

type TierLimitButtonProps = {
  disabled?: boolean;
  disabledReason?: string | null;
  className?: string;
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
};

export function TierLimitButton({
  disabled = false,
  disabledReason,
  className,
  children,
  onClick,
}: TierLimitButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? (disabledReason ?? undefined) : undefined}
      className={cn(className, disabled && "cursor-not-allowed opacity-50")}
    >
      {children}
    </button>
  );
}

type TierLimitNoticeProps = {
  message: string | null;
  className?: string;
};

export function TierLimitNotice({ message, className }: TierLimitNoticeProps) {
  if (!message) return null;
  return (
    <p className={cn("text-sm text-text-secondary", className)} role="status">
      {message}
    </p>
  );
}
