import Link from "next/link";
import { cn } from "@/lib/utils";

export function Button({
  className,
  variant = "primary",
  ...props
}: React.ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50",
        variant === "primary" &&
          "bg-accent text-white hover:bg-accent-hover",
        variant === "secondary" &&
          "border border-border bg-surface text-foreground hover:bg-background",
        variant === "ghost" && "text-muted hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function ButtonLink({
  href,
  className,
  variant = "primary",
  children,
  ...props
}: React.ComponentProps<typeof Link> & {
  variant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors",
        variant === "primary" &&
          "bg-accent text-white hover:bg-accent-hover",
        variant === "secondary" &&
          "border border-border bg-surface text-foreground hover:bg-background",
        variant === "ghost" && "text-muted hover:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}

export function StatusPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tone === "neutral" && "bg-background text-muted",
        tone === "success" && "bg-emerald-50 text-success",
        tone === "warning" && "bg-amber-50 text-warning",
        tone === "danger" && "bg-red-50 text-danger",
      )}
    >
      {label}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-surface p-5 sm:p-6",
        className,
      )}
    >
      {title ? (
        <h2 className="mb-4 text-sm font-semibold tracking-wide text-foreground uppercase">
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}

export function MetaRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}
