import { describe, expect, it } from "vitest";
import {
  pipelineClientInputSchema,
  pipelineLastContactUpdateSchema,
  pipelineTemperatureUpdateSchema,
} from "@/lib/pipeline/validation";

describe("pipelineClientInputSchema", () => {
  it("accepts an empty client and applies safe defaults", () => {
    const result = pipelineClientInputSchema.parse({});

    expect(result).toMatchObject({
      business_name: "",
      contact_name: "",
      status: "potential",
      lead_temperature: "unknown",
      health_check_sent: false,
      last_contact_date_explicit: false,
      tags: [],
    });
  });

  it("accepts the interested status and current multi-select tags", () => {
    const result = pipelineClientInputSchema.parse({
      business_name: "",
      contact_name: "",
      status: "interested",
      tags: ["Gym", "Instructor"],
      health_check_sent: true,
    });

    expect(result.status).toBe("interested");
    expect(result.lead_temperature).toBe("unknown");
    expect(result.tags).toEqual(["Gym", "Instructor"]);
    expect(result.health_check_sent).toBe(true);
  });

  it("preserves legacy tags on an existing record", () => {
    const result = pipelineClientInputSchema.parse({
      business_name: "Legacy prospect",
      contact_name: "",
      tags: ["Restaurant", "Retail"],
    });

    expect(result.tags).toEqual(["Restaurant", "Retail"]);
  });

  it("rejects invalid supplied values", () => {
    expect(
      pipelineClientInputSchema.safeParse({
        contact_email: "not-an-email",
      }).success,
    ).toBe(false);
    expect(
      pipelineClientInputSchema.safeParse({
        website_url: "not-a-url",
      }).success,
    ).toBe(false);
    expect(
      pipelineClientInputSchema.safeParse({
        estimated_monthly_value: -1,
      }).success,
    ).toBe(false);
    expect(
      pipelineClientInputSchema.safeParse({
        last_contact_date: "08/14/2026",
      }).success,
    ).toBe(false);
  });

  it("keeps temperature independent of pipeline stage", () => {
    const result = pipelineClientInputSchema.parse({
      status: "interested",
      lead_temperature: "lukewarm",
    });

    expect(result.status).toBe("interested");
    expect(result.lead_temperature).toBe("lukewarm");
  });

  it("accepts every temperature with any stage", () => {
    const result = pipelineClientInputSchema.parse({
      status: "proposal_sent",
      lead_temperature: "hot",
    });

    expect(result.status).toBe("proposal_sent");
    expect(result.lead_temperature).toBe("hot");
  });

  it("rejects an invalid temperature without changing status rules", () => {
    expect(
      pipelineClientInputSchema.safeParse({
        status: "interested",
        lead_temperature: "on_fire",
      }).success,
    ).toBe(false);
    expect(
      pipelineClientInputSchema.safeParse({
        status: "not-a-stage",
      }).success,
    ).toBe(false);
  });

  it("validates quick last-contact date updates", () => {
    expect(
      pipelineLastContactUpdateSchema.parse({
        last_contact_date: "2026-08-14",
      }).last_contact_date,
    ).toBe("2026-08-14");
    expect(
      pipelineLastContactUpdateSchema.parse({
        last_contact_date: null,
      }).last_contact_date,
    ).toBeNull();
    expect(
      pipelineLastContactUpdateSchema.safeParse({
        last_contact_date: "August 14",
      }).success,
    ).toBe(false);
  });

  it("validates temperature-only updates", () => {
    expect(
      pipelineTemperatureUpdateSchema.parse({
        lead_temperature: "warm",
      }).lead_temperature,
    ).toBe("warm");
    expect(
      pipelineTemperatureUpdateSchema.safeParse({
        lead_temperature: "boiling",
      }).success,
    ).toBe(false);
  });
});
