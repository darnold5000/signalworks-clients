import { describe, expect, it } from "vitest";
import type { TenantTechnicalProfile } from "@/lib/database/phase1-types";
import { profileToTechnologyFormState } from "@/components/admin/technical-profile-form";

describe("Technology & Services editor", () => {
  it("loads existing operational values and legacy integrations for editing", () => {
    const state = profileToTechnologyFormState(
      {
        primary_domain: "client.example",
        domain_registrar: "cloudflare",
        hosting_provider: "vercel",
        database_provider: "supabase",
        repository_owner: "Signal Works",
        payment_provider: null,
        stripe_connection_status: "connected",
        stripe_platform_account_id: "acct_example",
        stripe_connected_account_id: null,
        payment_method_notes: null,
        email_provider: "resend",
        email_sending_domain: "mail.client.example",
        sms_provider: null,
        twilio_account_sid: null,
        twilio_phone_number: null,
        twilio_number_type: null,
        sms_enabled: null,
        api_integrations: {
          google_maps: { enabled: true },
          custom_mindbody: { enabled: true, name: "Mindbody" },
        },
        technical_notes: "Call the owner before DNS changes.",
      } as unknown as TenantTechnicalProfile,
      null,
      null,
    );

    expect(state).toMatchObject({
      primary_domain: "client.example",
      domain_registrar: "cloudflare",
      hosting_provider: "vercel",
      database_provider: "supabase",
      repository_owner: "Signal Works",
      payment_provider: "stripe",
      stripe_platform_account_id: "acct_example",
      email_provider: "resend",
      technical_notes: "Call the owner before DNS changes.",
    });
    expect(state.api_integrations.google_maps?.enabled).toBe(true);
    expect(state.api_integrations.custom_mindbody?.name).toBe("Mindbody");
  });
});
