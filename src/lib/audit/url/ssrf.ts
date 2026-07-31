import { lookup as dnsLookup } from "node:dns/promises";
import { assertHostnameAllowed } from "@/lib/audit/url/normalize";

export class SsrfBlockedError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "SsrfBlockedError";
    this.code = code;
  }
}

export async function resolveHostnameForAudit(hostname: string): Promise<string[]> {
  assertHostnameAllowed(hostname);

  let records: { address: string; family: number }[];
  try {
    records = await dnsLookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new SsrfBlockedError("dns_resolution_failed", "Could not resolve hostname.");
  }

  if (records.length === 0) {
    throw new SsrfBlockedError("dns_resolution_empty", "Could not resolve hostname.");
  }

  const addresses = records.map((record) => record.address);
  for (const address of addresses) {
    assertResolvedAddressAllowed(address);
  }

  return addresses;
}

export function assertResolvedAddressAllowed(address: string): void {
  const lower = address.toLowerCase();

  if (lower === "127.0.0.1" || lower === "::1" || lower === "0.0.0.0") {
    throw new SsrfBlockedError("private_ip", "Private network addresses are not allowed.");
  }

  if (lower.startsWith("10.")) {
    throw new SsrfBlockedError("private_ip", "Private network addresses are not allowed.");
  }

  if (lower.startsWith("192.168.")) {
    throw new SsrfBlockedError("private_ip", "Private network addresses are not allowed.");
  }

  if (lower.startsWith("169.254.")) {
    throw new SsrfBlockedError("link_local_ip", "Link-local addresses are not allowed.");
  }

  const ipv4Match = /^(\d+)\.(\d+)\./.exec(lower);
  if (ipv4Match) {
    const first = Number(ipv4Match[1]);
    const second = Number(ipv4Match[2]);
    if (first === 172 && second >= 16 && second <= 31) {
      throw new SsrfBlockedError("private_ip", "Private network addresses are not allowed.");
    }
    if (first >= 224) {
      throw new SsrfBlockedError("multicast_ip", "Multicast addresses are not allowed.");
    }
  }

  if (lower.startsWith("fc") || lower.startsWith("fd")) {
    throw new SsrfBlockedError("private_ip", "Private network addresses are not allowed.");
  }

  if (lower.startsWith("fe80")) {
    throw new SsrfBlockedError("link_local_ip", "Link-local addresses are not allowed.");
  }
}

export async function validateRedirectTarget(url: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SsrfBlockedError("invalid_redirect", "Invalid redirect destination.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SsrfBlockedError("invalid_redirect_protocol", "Invalid redirect destination.");
  }

  if (parsed.username || parsed.password) {
    throw new SsrfBlockedError("redirect_credentials", "Invalid redirect destination.");
  }

  assertHostnameAllowed(parsed.hostname);
  await resolveHostnameForAudit(parsed.hostname);
  return parsed;
}
