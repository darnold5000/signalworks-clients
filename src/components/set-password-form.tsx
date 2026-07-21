"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui";
import { establishSessionFromAuthLink } from "@/lib/auth/hash-session";
import { siteConfig } from "@/lib/site";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

const inviteLinkErrorMessage =
  "This invitation link is invalid or has expired. Invite links work once — if you already opened it on another device, ask Signal Works to resend. On mobile, open the link in Safari or Chrome (not the in-app email browser).";

type SetPasswordFormProps = {
  cleanPath?: string;
};

export function SetPasswordForm({
  cleanPath = "/auth/set-password",
}: SetPasswordFormProps) {
  const [email, setEmail] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function establishSession() {
      if (!isSupabaseConfigured()) {
        if (!cancelled) {
          setSessionError("Invitations are not configured.");
        }
        return;
      }

      const params = new URLSearchParams(window.location.search);
      if (params.get("error") === "invite_link") {
        if (!cancelled) setSessionError(inviteLinkErrorMessage);
        return;
      }

      const supabase = createClient();
      const result = await establishSessionFromAuthLink(supabase, cleanPath);

      if (cancelled) return;

      if (!result.ok) {
        setSessionError(inviteLinkErrorMessage);
        return;
      }

      setEmail(result.email);
      if (result.fullName) {
        setFullName(result.fullName);
      }
      setReady(true);
    }

    void establishSession();
    return () => {
      cancelled = true;
    };
  }, [cleanPath]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, fullName }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        redirectTo?: string;
      };

      if (!res.ok) {
        setError(data.error ?? "Unable to activate account");
        setPending(false);
        return;
      }

      window.location.assign(data.redirectTo ?? "/overview");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to activate account",
      );
      setPending(false);
    }
  }

  if (sessionError) {
    return (
      <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-surface p-8 shadow-sm">
        <h1 className="font-display text-2xl">Invitation expired</h1>
        <p className="text-sm text-muted">{sessionError}</p>
        <div className="flex flex-col gap-2 text-sm">
          <Link
            href="/login"
            className="font-medium underline underline-offset-2"
          >
            Back to sign in
          </Link>
          <Link
            href="/login?forgot=1"
            className="font-medium underline underline-offset-2"
          >
            Request a password reset email
          </Link>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 shadow-sm">
        <p className="text-sm text-muted">Loading your invitation…</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-6 rounded-xl border border-border bg-surface p-8 shadow-sm">
      <div>
        <h1 className="font-display text-2xl">Create your password</h1>
        <p className="mt-1 text-sm text-muted">
          Your {siteConfig.name} account is ready
          {email ? ` for ${email}` : ""}. Choose a password to finish setup.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Your name</span>
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Password</span>
          <div className="relative">
            <input
              required
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2.5 pr-10 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Confirm password</span>
          <input
            required
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm"
          />
        </label>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Saving…" : "Create password & continue"}
        </Button>
      </form>
    </div>
  );
}
