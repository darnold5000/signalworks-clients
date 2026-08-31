import { describe, expect, it } from "vitest";
import {
  buildNewClientPortalSettings,
  createClientSchema,
  NEW_CLIENT_ONBOARDING_STATUS,
} from "@/lib/admin/client-creation";

const base = {
  businessName: "Ton Tavern Fitness",
  status: "prospect" as const,
  websiteUrl: "",
  domain: "",
  businessPhone: "",
};

describe("createClientSchema", () => {
  it("creates a client payload without any proposal, billing, or auth fields", () => {
    const parsed = createClientSchema.parse({ ...base, contacts: [] });
    expect(parsed.businessName).toBe("Ton Tavern Fitness");
    expect(parsed).not.toHaveProperty("offer");
    expect(parsed).not.toHaveProperty("subscription");
    expect(parsed).not.toHaveProperty("authUser");
    expect(parsed.websiteStatus).toBe("not_set");
    expect(NEW_CLIENT_ONBOARDING_STATUS).toBe("not_started");
  });

  it("creates no fake website, security, plan, or setup defaults", () => {
    const parsed = createClientSchema.parse({ ...base, contacts: [] });
    expect(buildNewClientPortalSettings("tenant-1", parsed)).toMatchObject({
      website_status: "not_set",
      website_url: null,
      domain: null,
      hosting_status: "none",
      website_security_status: null,
      website_security_https_enabled: null,
      website_security_cert_valid: null,
      website_security_cert_expires_at: null,
      plan_inclusions: [],
      setup_inclusions: [],
      plan_name: null,
      monthly_price_cents: null,
    });
  });

  it("accepts multiple contacts and normalizes email case", () => {
    const parsed = createClientSchema.parse({
      ...base,
      contacts: [
        { name: "Jeremy", email: "Jeremy@Example.com", isPrimary: true, receivesProposals: true },
        { name: "Jane", email: "JANE@example.com", receivesProposals: true },
      ],
    });
    expect(parsed.contacts.map((contact) => contact.email)).toEqual(["jeremy@example.com", "jane@example.com"]);
    expect(parsed.contacts.filter((contact) => contact.isPrimary)).toHaveLength(1);
    expect(parsed.contacts[0]).toMatchObject({
      receivesProposals: true,
      receivesBilling: false,
      receivesNotifications: false,
    });
  });

  it("rejects multiple primary contacts", () => {
    const result = createClientSchema.safeParse({ ...base, contacts: [
      { name: "Jeremy", email: "jeremy@example.com", isPrimary: true },
      { name: "Jane", email: "jane@example.com", isPrimary: true },
    ] });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate contact emails case-insensitively", () => {
    const result = createClientSchema.safeParse({ ...base, contacts: [
      { name: "Jeremy", email: "jeremy@example.com", isPrimary: true },
      { name: "Duplicate", email: "JEREMY@example.com" },
    ] });
    expect(result.success).toBe(false);
  });
});
