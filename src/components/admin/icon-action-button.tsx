"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const base =
  "inline-flex size-8 items-center justify-center rounded-md border border-border text-muted transition-colors hover:bg-background hover:text-foreground disabled:opacity-50";

export function IconActionButton({
  label,
  icon: Icon,
  onClick,
  disabled,
  variant = "default",
  className,
}: {
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "default" | "danger";
  className?: string;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        base,
        variant === "danger" &&
          "border-red-200 text-danger hover:bg-red-50 hover:text-danger",
        className,
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}

export function IconActionLink({
  label,
  icon: Icon,
  href,
  variant = "default",
  className,
}: {
  label: string;
  icon: LucideIcon;
  href: string;
  variant?: "default" | "danger";
  className?: string;
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className={cn(
        base,
        variant === "danger" &&
          "border-red-200 text-danger hover:bg-red-50 hover:text-danger",
        className,
      )}
    >
      <Icon className="size-4" aria-hidden />
    </Link>
  );
}
