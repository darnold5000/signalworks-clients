export type UrlValidationErrorCode =
  | "empty"
  | "invalid_url"
  | "unsupported_protocol"
  | "embedded_credentials"
  | "blocked_hostname"
  | "blocked_port"
  | "missing_hostname";

export class UrlValidationError extends Error {
  readonly code: UrlValidationErrorCode;

  constructor(code: UrlValidationErrorCode, message: string) {
    super(message);
    this.name = "UrlValidationError";
    this.code = code;
  }
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
]);

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".lan"];

const DEFAULT_ALLOWED_PORTS = new Set([80, 443]);

export type NormalizeUrlOptions = {
  allowedPorts?: Set<number>;
};

export type NormalizedUrlResult = {
  input: string;
  normalizedUrl: string;
  normalizedDomain: string;
  hostname: string;
  port: number | null;
};

export function normalizeAuditUrl(
  rawInput: string,
  options: NormalizeUrlOptions = {},
): NormalizedUrlResult {
  const input = rawInput.trim();
  if (!input) {
    throw new UrlValidationError("empty", "Website URL is required.");
  }

  let parsed: URL;
  try {
    parsed = new URL(input.includes("://") ? input : `https://${input}`);
  } catch {
    throw new UrlValidationError("invalid_url", "Enter a valid website URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UrlValidationError(
      "unsupported_protocol",
      "Only HTTP and HTTPS URLs are supported.",
    );
  }

  if (parsed.username || parsed.password) {
    throw new UrlValidationError(
      "embedded_credentials",
      "URLs with embedded credentials are not allowed.",
    );
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) {
    throw new UrlValidationError("missing_hostname", "URL must include a hostname.");
  }

  assertHostnameAllowed(hostname);

  const port = parsed.port ? Number(parsed.port) : null;
  const allowedPorts = options.allowedPorts ?? DEFAULT_ALLOWED_PORTS;
  const effectivePort = port ?? (parsed.protocol === "https:" ? 443 : 80);
  if (!allowedPorts.has(effectivePort)) {
    throw new UrlValidationError("blocked_port", "This URL port is not allowed.");
  }

  parsed.hash = "";
  const normalizedUrl = parsed.toString();
  const normalizedDomain = hostname.replace(/^www\./, "");

  return {
    input,
    normalizedUrl,
    normalizedDomain,
    hostname,
    port,
  };
}

export function assertHostnameAllowed(hostname: string): void {
  const lower = hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(lower)) {
    throw new UrlValidationError("blocked_hostname", "This hostname is not allowed.");
  }

  for (const suffix of BLOCKED_HOST_SUFFIXES) {
    if (lower.endsWith(suffix)) {
      throw new UrlValidationError("blocked_hostname", "This hostname is not allowed.");
    }
  }

  if (isBlockedLiteralIp(lower)) {
    throw new UrlValidationError("blocked_hostname", "Private network addresses are not allowed.");
  }
}

function isBlockedLiteralIp(value: string): boolean {
  if (value.includes(":")) {
    return isBlockedIpv6(value);
  }

  const parts = value.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }

  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a >= 224) return true;
  return false;
}

function isBlockedIpv6(value: string): boolean {
  const lower = value.toLowerCase();
  if (lower === "::1") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("fe80")) return true;
  return false;
}
