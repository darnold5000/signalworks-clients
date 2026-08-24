import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isPublicAuditApiAuthorized,
  publicAuditUnauthorizedResponse,
} from "@/lib/audit/public/auth";

function requestWithAuditKey(apiKey?: string): Request {
  const headers = new Headers();
  if (apiKey != null) {
    headers.set("x-audit-api-key", apiKey);
  }
  return new Request("https://clients.example.com/api/public/audits/run", {
    method: "POST",
    headers,
  });
}

describe("isPublicAuditApiAuthorized", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("denies in production when no configured key", () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.AUDIT_PUBLIC_API_KEY;

    expect(isPublicAuditApiAuthorized(requestWithAuditKey("anything"))).toBe(false);
  });

  it("denies in production when configured key is missing from header", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUDIT_PUBLIC_API_KEY", "expected-secret");

    expect(isPublicAuditApiAuthorized(requestWithAuditKey())).toBe(false);
  });

  it("denies in production when configured key does not match header", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUDIT_PUBLIC_API_KEY", "expected-secret");

    expect(isPublicAuditApiAuthorized(requestWithAuditKey("wrong-secret"))).toBe(false);
  });

  it("allows in production when configured key matches header", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUDIT_PUBLIC_API_KEY", "expected-secret");

    expect(isPublicAuditApiAuthorized(requestWithAuditKey("expected-secret"))).toBe(true);
  });

  it("allows in non-production when no configured key", () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.AUDIT_PUBLIC_API_KEY;

    expect(isPublicAuditApiAuthorized(requestWithAuditKey())).toBe(true);
  });

  it("requires matching header in non-production when key is configured", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUDIT_PUBLIC_API_KEY", "expected-secret");

    expect(isPublicAuditApiAuthorized(requestWithAuditKey("expected-secret"))).toBe(true);
    expect(isPublicAuditApiAuthorized(requestWithAuditKey("wrong-secret"))).toBe(false);
  });
});

describe("publicAuditUnauthorizedResponse", () => {
  it("does not expose secret values", async () => {
    vi.stubEnv("AUDIT_PUBLIC_API_KEY", "super-secret-value");
    const response = publicAuditUnauthorizedResponse();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(JSON.stringify(body)).not.toContain("super-secret-value");
    expect(body).toEqual({ error: "Unauthorized." });
  });
});
