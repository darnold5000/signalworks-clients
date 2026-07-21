"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "overview", label: "Overview" },
  { href: "technical", label: "Technical" },
  { href: "contacts", label: "Contacts" },
  { href: "activity", label: "Activity" },
] as const;

export function AdminClientNav({ tenantId }: { tenantId: string }) {
  const pathname = usePathname();
  const base = `/admin/clients/${tenantId}`;

  return (
    <nav className="mb-8 flex gap-1 overflow-x-auto border-b border-border">
      {TABS.map((tab) => {
        const href = `${base}/${tab.href}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={tab.href}
            href={href}
            className={cn(
              "whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-foreground text-foreground"
                : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
