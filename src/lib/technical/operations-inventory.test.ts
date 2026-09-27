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

    expect(parsed.api_integrations?.custom_square?.name).toBe("Square");
  });

  it("accepts UptimeRobot monitor id on technical profile updates", () => {
    const parsed = technicalProfileUpdateSchema.parse({
      uptime_robot_monitor_id: "801234567",
    });
    expect(parsed.uptime_robot_monitor_id).toBe("801234567");
  });

  it("accepts operational payment and Twilio identifiers but strips secrets", () => {
    const parsed = technicalProfileUpdateSchema.parse({
      payment_provider: "stripe",
      stripe_platform_account_id: "acct_example",
      sms_provider: "twilio",
      twilio_account_sid: "ACexample",
      twilio_phone_number: "+13175550123",
      twilio_number_type: "toll_free",
      sms_enabled: true,
      api_key: "must-not-be-stored",
      auth_token: "must-not-be-stored",
      password: "must-not-be-stored",
    });

    expect(parsed).toMatchObject({
      payment_provider: "stripe",
      stripe_platform_account_id: "acct_example",
      sms_provider: "twilio",
      twilio_account_sid: "ACexample",
      twilio_number_type: "toll_free",
      sms_enabled: true,
    });
    expect(parsed).not.toHaveProperty("api_key");
    expect(parsed).not.toHaveProperty("auth_token");
    expect(parsed).not.toHaveProperty("password");
  });

  it("leaves hidden legacy objects undefined when omitted", () => {
    const parsed = technicalProfileUpdateSchema.parse({
      primary_domain: "example.com",
    });

    expect(parsed.service_ownership).toBeUndefined();
    expect(parsed.access_status).toBeUndefined();
    expect(parsed.managed_services).toBeUndefined();
    expect(parsed.monitoring_config).toBeUndefined();
  });
});
