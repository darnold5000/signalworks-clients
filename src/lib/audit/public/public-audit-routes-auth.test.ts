import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as runAuditPost } from "@/app/api/public/audits/run/route";
import { GET as readAuditGet } from "@/app/api/public/audits/[token]/route";
import { GET as reportAuditGet } from "@/app/api/public/audits/[token]/report/route";
import { POST as claimAuditPost } from "@/app/api/public/audits/[token]/notification-claim/route";

const token = "a".repeat(64);

function unauthorizedResponseBody(response: Response) {
  return response.json() as Promise<{ error?: string }>;
}

describe("public audit route authorization", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUDIT_PUBLIC_API_KEY", "expected-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("POST /api/public/audits/run returns 401 without key", async () => {
    const request = new NextRequest("http://localhost/api/public/audits/run", {
      method: "POST",
      body: JSON.stringify({ rawUrl: "https://example.com" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await runAuditPost(request);
    const body = await unauthorizedResponseBody(response);

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized.");
    expect(JSON.stringify(body)).not.toContain("expected-secret");
  });

  it("GET /api/public/audits/[token] returns 401 without key", async () => {
    const request = new NextRequest(`http://localhost/api/public/audits/${token}`);
    const response = await readAuditGet(request, { params: Promise.resolve({ token }) });
    const body = await unauthorizedResponseBody(response);

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized.");
  });

  it("GET /api/public/audits/[token]/report returns 401 without key", async () => {
    const request = new NextRequest(`http://localhost/api/public/audits/${token}/report`);
    const response = await reportAuditGet(request, { params: Promise.resolve({ token }) });
    const body = await unauthorizedResponseBody(response);

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized.");
  });

  it("POST /api/public/audits/[token]/notification-claim returns 401 without key", async () => {
    const request = new NextRequest(
      `http://localhost/api/public/audits/${token}/notification-claim`,
      { method: "POST" },
    );
    const response = await claimAuditPost(request, { params: Promise.resolve({ token }) });
    const body = await unauthorizedResponseBody(response);

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized.");
  });

  it("POST /api/public/audits/run returns 401 with wrong key", async () => {
    const request = new NextRequest("http://localhost/api/public/audits/run", {
      method: "POST",
      body: JSON.stringify({ rawUrl: "https://example.com" }),
      headers: {
        "Content-Type": "application/json",
        "x-audit-api-key": "wrong-secret",
      },
    });

    const response = await runAuditPost(request);
    expect(response.status).toBe(401);
  });
});
