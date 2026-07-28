"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { establishSessionFromAuthLink } from "@/lib/auth/hash-session";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

const inviteLinkErrorMessage =
  "This link is invalid or has expired. Try signing in with your email and password, or ask Signal Works to resend.";

function safeNextPath(nextRaw: string | null, defaultNext: string): string {
  if (nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//")) {
    return nextRaw;
  }
  return defaultNext;
}

export function EstablishSessionRedirect({
  defaultNext = "/offer",
}: {
  defaultNext?: string;
}) {
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function run() {
      if (!isSupabaseConfigured()) {
        setError("Sign-in is not configured.");
        return;
      }

      const { search, hash } = window.location;

      // PKCE / OTP query params are handled reliably on the server callback route.
      if (search.includes("code=") || search.includes("token_hash=")) {
        window.location.replace(`/auth/callback${search}${hash}`);
        return;
      }

      const next = safeNextPath(nextParam, defaultNext);

      if (!hash.includes("access_token")) {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          window.location.assign(next);
          return;
        }
        setError(inviteLinkErrorMessage);
        return;
      }

      const supabase = createClient();
      const result = await establishSessionFromAuthLink(
        supabase,
        "/auth/establish-session",
      );

      if (!result.ok) {
        setError(inviteLinkErrorMessage);
        return;
      }

      window.location.assign(next);
    }

    void run();
  }, [defaultNext, nextParam]);

  if (error) {
    return (
      <div className="space-y-3 text-sm">
        <p className="text-danger">{error}</p>
        <p>
          <a href="/login" className="font-medium underline underline-offset-2">
            Go to sign in
          </a>
        </p>
      </div>
    );
  }

  return <p className="text-sm text-muted">Signing you in…</p>;
}
