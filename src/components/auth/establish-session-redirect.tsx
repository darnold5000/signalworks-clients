"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { establishSessionFromAuthLink } from "@/lib/auth/hash-session";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

const inviteLinkErrorMessage =
  "This link is invalid or has expired. Try signing in with your email and password, or ask Signal Works to resend.";

export function EstablishSessionRedirect({
  defaultNext = "/offer",
}: {
  defaultNext?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!isSupabaseConfigured()) {
        if (!cancelled) setError("Sign-in is not configured.");
        return;
      }

      const nextRaw = searchParams.get("next");
      const next =
        nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//")
          ? nextRaw
          : defaultNext;

      const supabase = createClient();
      const result = await establishSessionFromAuthLink(
        supabase,
        "/auth/establish-session",
      );

      if (cancelled) return;

      if (!result.ok) {
        setError(inviteLinkErrorMessage);
        return;
      }

      router.replace(next);
      router.refresh();
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [defaultNext, router, searchParams]);

  if (error) {
    return (
      <p className="text-sm text-danger">
        {error}{" "}
        <a href="/login" className="font-medium underline underline-offset-2">
          Go to sign in
        </a>
      </p>
    );
  }

  return <p className="text-sm text-muted">Signing you in…</p>;
}
