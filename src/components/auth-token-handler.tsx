"use client";

import { useEffect } from "react";
import { getAuthTokensRedirectUrl } from "@/lib/auth/hash-session";

/**
 * Catches invite / recovery tokens in the URL hash or query on any page
 * (including `/` and `/login`) and routes them to the correct auth handler.
 */
export function AuthTokenHandler() {
  useEffect(() => {
    const target = getAuthTokensRedirectUrl();
    if (!target) return;
    window.location.replace(target);
  }, []);

  return null;
}
