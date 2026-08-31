import { describe, expect, it } from "vitest";
import { createClientSchema } from "@/lib/admin/client-creation";

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
