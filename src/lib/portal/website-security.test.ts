import { describe, expect, it } from "vitest";
import { resolveWebsiteSecurityStatus } from "@/lib/portal/website-security";

const unknown = {
  website_security_status: null,
  website_security_https_enabled: null,
  website_security_cert_valid: null,
  website_security_cert_expires_at: null,
  ssl_status: "none" as const,
};

describe("resolveWebsiteSecurityStatus", () => {
  it("treats absent security evidence as not assessed", () => {
    expect(resolveWebsiteSecurityStatus(unknown)).toBe("not_assessed");
  });

  it("preserves explicit saved security status", () => {
    expect(resolveWebsiteSecurityStatus({
      ...unknown,
      website_security_status: "protected",
      website_security_https_enabled: true,
      website_security_cert_valid: true,
      ssl_status: "active",
    })).toBe("protected");
  });
});
