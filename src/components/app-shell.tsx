"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  FileText,
  GitBranch,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  MessageSquarePlus,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/site";
import { isSupabaseConfigured } from "@/lib/supabase/client";

const CLIENT_NAV = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/offer", label: "Proposal", icon: FileText },
  { href: "/requests", label: "Requests", icon: MessageSquarePlus },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/purchases", label: "Purchases", icon: FileText },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/support", label: "Support", icon: LifeBuoy },
];

const ADMIN_NAV = [
  { href: "/admin/clients", label: "Clients", icon: Shield },
  { href: "/admin/pipeline", label: "Pipeline", icon: GitBranch },
];

export function AppShell({
  children,
  businessName,
  isAdmin,
  userEmail,
}: {
  children: React.ReactNode;
  businessName?: string;
  isAdmin: boolean;
  userEmail: string;
}) {
  const pathname = usePathname();
  const nav = isAdmin ? ADMIN_NAV : CLIENT_NAV;

  async function signOut() {
    if (isSupabaseConfigured()) {
      await fetch("/api/auth/logout", { method: "POST" });
    }
    document.cookie = "sw_demo_mode=; Max-Age=0; path=/";
    window.location.assign("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <Link href={isAdmin ? "/admin/clients" : "/overview"} className="block">
              <p className="font-display text-xl text-foreground">
                {siteConfig.name}
              </p>
              <p className="text-xs tracking-wide text-muted uppercase">
                {isAdmin ? "Admin" : "Client Portal"}
              </p>
            </Link>
            {businessName ? (
              <p className="mt-1 text-sm text-muted">{businessName}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted sm:inline">
              {userEmail}
            </span>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted hover:text-foreground"
            >
              <LogOut className="size-3.5" />
              Sign out
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-3 sm:px-6">
          {nav.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors",
                  active
                    ? "bg-accent text-white"
                    : "text-muted hover:bg-background hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
