import { AUDIT_FETCH_LIMITS, AUDIT_USER_AGENT } from "@/lib/audit/constants";
import { normalizeAuditUrl } from "@/lib/audit/url/normalize";
import {
  resolveHostnameForAudit,
  SsrfBlockedError,
  validateRedirectTarget,
} from "@/lib/audit/url/ssrf";
import type { SafeFetchFn, SafeFetchOptions, SafeFetchResponse } from "@/lib/audit/types";

export function createSafeFetch(
  fetchImpl: typeof fetch = fetch,
): SafeFetchFn {
  return async (rawUrl, options = {}) => {
    const limits = {
      timeoutMs: options.timeoutMs ?? AUDIT_FETCH_LIMITS.timeoutMs,
      maxRedirects: options.maxRedirects ?? AUDIT_FETCH_LIMITS.maxRedirects,
      maxResponseBytes:
        options.maxResponseBytes ?? AUDIT_FETCH_LIMITS.maxResponseBytes,
      userAgent: options.userAgent ?? AUDIT_USER_AGENT,
    };

    const normalized = normalizeAuditUrl(rawUrl);
    assertAllowlistedHostname(normalized.hostname, options.allowedHostnames);
    await resolveHostnameForAudit(normalized.hostname);

    const redirectChain: string[] = [normalized.normalizedUrl];
    const redirectStatuses: number[] = [];
    let currentUrl = normalized.normalizedUrl;

    for (let hop = 0; hop <= limits.maxRedirects; hop += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), limits.timeoutMs);

      let response: Response;
      try {
        response = await fetchImpl(currentUrl, {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
          headers: {
            "user-agent": limits.userAgent,
            accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
          },
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new SsrfBlockedError("timeout", "Request timed out.");
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }

      if (isRedirectStatus(response.status)) {
        const location = response.headers.get("location");
        if (!location) {
          throw new SsrfBlockedError("invalid_redirect", "Redirect missing location header.");
        }

        const nextUrl = new URL(location, currentUrl).toString();
        if (redirectChain.includes(nextUrl)) {
          throw new SsrfBlockedError("redirect_loop", "Redirect loop detected.");
        }

        await validateRedirectTarget(nextUrl);
        assertAllowlistedHostname(
          new URL(nextUrl).hostname,
          options.allowedHostnames,
        );
        redirectChain.push(nextUrl);
        redirectStatuses.push(response.status);
        currentUrl = nextUrl;
        continue;
      }

      const bodyText = await readLimitedBody(response, limits.maxResponseBytes);
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });

      return {
        url: normalized.normalizedUrl,
        finalUrl: currentUrl,
        status: response.status,
        headers,
        bodyText,
        redirectChain,
        redirectStatuses,
      } satisfies SafeFetchResponse;
    }

    throw new SsrfBlockedError("too_many_redirects", "Too many redirects.");
  };
}

function assertAllowlistedHostname(
  hostname: string,
  allowedHostnames?: ReadonlySet<string>,
): void {
  if (!allowedHostnames) return;
  const normalized = hostname.toLowerCase();
  if (![...allowedHostnames].some((allowed) => allowed.toLowerCase() === normalized)) {
    throw new SsrfBlockedError(
      "hostname_not_allowlisted",
      "Redirect left the configured website hostname.",
    );
  }
}

function isRedirectStatus(status: number): boolean {
  return status >= 300 && status < 400;
}

async function readLimitedBody(
  response: Response,
  maxBytes: number,
): Promise<string> {
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    total += value.byteLength;
    if (total > maxBytes) {
      throw new SsrfBlockedError("response_too_large", "Response exceeded size limit.");
    }
    chunks.push(value);
  }

  const merged = Buffer.concat(chunks);
  return merged.toString("utf8");
}

export type { SafeFetchOptions, SafeFetchResponse };
