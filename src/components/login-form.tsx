"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { isClientAuthDebugEnabled } from "@/lib/auth-debug";
import {
  createClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import { siteConfig } from "@/lib/site";

function clientAuthDebug(scope: string, detail?: Record<string, unknown>) {
  if (!isClientAuthDebugEnabled()) return;
  console.info(`[auth:${scope}]`, detail ?? {});
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword(
        {
          email,
          password,
        },
      );

      clientAuthDebug("login", {
        loginResultUserId: data.user?.id ?? null,
        error: signInError?.message ?? null,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      if (!data.user) {
        setError("Sign-in succeeded but no user was returned.");
        return;
      }

      clientAuthDebug("login-cookies", {
        cookieNames: document.cookie
          .split(";")
          .map((part) => part.trim().split("=")[0])
          .filter(Boolean),
      });

      // Refresh RSC cache, then hard-navigate so the server receives auth cookies.
      router.refresh();
      window.location.assign("/");
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
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-foreground"
            />
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
