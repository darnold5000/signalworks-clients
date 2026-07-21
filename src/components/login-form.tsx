"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui";
import { isClientAuthDebugEnabled } from "@/lib/auth-debug";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { siteConfig } from "@/lib/site";

function clientAuthDebug(scope: string, detail?: Record<string, unknown>) {
  if (!isClientAuthDebugEnabled()) return;
  console.info(`[auth:${scope}]`, detail ?? {});
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackError = searchParams.get("error") === "auth_callback";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const demo = !isSupabaseConfigured();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (demo) {
        document.cookie = "sw_demo_mode=client; path=/; max-age=86400";
        router.refresh();
        router.push("/overview");
        return;
      }

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = (await res.json()) as {
        error?: string;
        ok?: boolean;
        userId?: string;
        redirectTo?: string;
      };

      clientAuthDebug("login", {
        loginResultUserId: data.userId ?? null,
        redirectTo: data.redirectTo ?? null,
        status: res.status,
        error: data.error ?? null,
      });

      if (!res.ok) {
        setError(data.error ?? "Could not sign in.");
        return;
      }

      clientAuthDebug("login-cookies", {
        cookieNames: document.cookie
          .split(";")
          .map((part) => part.trim().split("=")[0])
          .filter(Boolean),
      });

      window.location.assign(data.redirectTo ?? "/");
    } finally {
      setLoading(false);
    }
  }

  function enterDemo(mode: "client" | "admin") {
    document.cookie = `sw_demo_mode=${mode}; path=/; max-age=86400`;
    router.refresh();
    router.push(mode === "admin" ? "/admin" : "/overview");
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-sm">
      <p className="font-display text-3xl text-foreground">{siteConfig.name}</p>
      <h1 className="mt-2 text-lg font-medium text-foreground">
        Client Portal
      </h1>
      <p className="mt-2 text-sm text-muted">
        Sign in to view your website status, billing, and update requests.
      </p>

      {demo ? (
        <div className="mt-6 space-y-3 rounded-lg border border-dashed border-border bg-background p-4">
          <p className="text-sm text-muted">
            Supabase is not configured. Explore the UI with demo data:
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" onClick={() => enterDemo("client")}>
              Demo as client
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => enterDemo("admin")}
            >
              Demo as admin
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {callbackError ? (
            <p className="text-sm text-danger">
              That sign-in link expired or was invalid. Sign in below, or ask
              Signal Works to resend your invite.
            </p>
          ) : null}
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-foreground"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Password</span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-border bg-background py-2.5 pr-10 pl-3 text-sm outline-none focus:border-foreground"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </label>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      )}
    </div>
  );
}
