import { describe, expect, it } from "vitest";
import { parseThirdPartyIntegrations } from "@/lib/technical/operations-inventory";
import { technicalProfileUpdateSchema } from "@/lib/technical/technical-profile-schema";

describe("custom third-party integrations", () => {
  it("parses custom integration names alongside catalog integrations", () => {
    expect(
      parseThirdPartyIntegrations({
        custom_square: {
          enabled: true,
          name: "Square",
          account_owner: "Client",
          notes: "Production account",
        },
      }),
    ).toEqual({
      custom_square: {
        enabled: true,
        name: "Square",
        account_owner: "Client",
        notes: "Production account",
      },
    });
  });

  it("preserves custom integrations during request validation", () => {
    const parsed = technicalProfileUpdateSchema.parse({
      api_integrations: {
        custom_square: {
          enabled: true,
          name: "Square",
          account_owner: null,
          notes: null,
        },
      },
    });

    expect(parsed.api_integrations.custom_square?.name).toBe("Square");
  });
});
