import { describe, expect, it } from "vitest";
import {
  pipelineClientInputSchema,
  pipelineLastContactUpdateSchema,
} from "@/lib/pipeline/validation";

describe("pipelineClientInputSchema", () => {
  it("accepts an empty client and applies safe defaults", () => {
    const result = pipelineClientInputSchema.parse({});

    expect(result).toMatchObject({
      business_name: "",
      contact_name: "",
      status: "potential",
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
});
