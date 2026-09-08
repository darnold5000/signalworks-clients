import { describe, expect, it } from "vitest";
import { formatPipelineDate } from "@/lib/pipeline/dates";
import {
  filterPipelineClients,
  sortPipelineClients,
} from "@/lib/pipeline/query";
import { normalizeLeadTemperature, isLeadTemperatureVisible } from "@/lib/pipeline/types";
import type { ClientPipelineRecord, LeadTemperature } from "@/lib/pipeline/types";

function record(
  overrides: Partial<ClientPipelineRecord> & { id: string; business_name: string },
): ClientPipelineRecord {
  return {
    tenant_id: "tenant",
    contact_name: "Contact",
    contact_email: null,
    phone: null,
    website_url: null,
    status: "potential",
    lead_temperature: "unknown",
    last_conversation: null,
    plan: null,
    estimated_monthly_value_cents: null,
    next_follow_up_date: null,
    last_contacted_at: null,
    health_check_sent: false,
    tags: [],
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("normalizeLeadTemperature", () => {
  it("defaults missing or invalid values to unknown without touching status", () => {
    expect(normalizeLeadTemperature(undefined)).toBe("unknown");
    expect(normalizeLeadTemperature(null)).toBe("unknown");
    expect(normalizeLeadTemperature("on_fire")).toBe("unknown");
    expect(normalizeLeadTemperature("hot")).toBe("hot");
  });
});

describe("isLeadTemperatureVisible", () => {
  it("is visible only for Interested and Proposal Sent", () => {
    expect(isLeadTemperatureVisible("interested")).toBe(true);
    expect(isLeadTemperatureVisible("proposal_sent")).toBe(true);
    expect(isLeadTemperatureVisible("potential")).toBe(false);
    expect(isLeadTemperatureVisible("contact_made")).toBe(false);
    expect(isLeadTemperatureVisible("won")).toBe(false);
  });
});

describe("filterPipelineClients", () => {
  const clients = [
    record({
      id: "1",
      business_name: "Case Freight LLC",
      status: "interested",
      lead_temperature: "hot",
    }),
    record({
      id: "2",
      business_name: "Oak Tree Golf",
      status: "interested",
      lead_temperature: "lukewarm",
    }),
    record({
      id: "3",
      business_name: "Market Street",
      status: "potential",
      lead_temperature: "unknown",
    }),
  ];

  it("filters by temperature without changing stage matching", () => {
    const hot = filterPipelineClients(clients, {
      query: "",
      statusFilter: "all",
      temperatureFilter: "hot",
      healthCheckFilter: "all",
    });
    expect(hot.map((client) => client.business_name)).toEqual([
      "Case Freight LLC",
    ]);
    expect(hot[0]?.status).toBe("interested");

    const interested = filterPipelineClients(clients, {
      query: "",
      statusFilter: "interested",
      temperatureFilter: "all",
      healthCheckFilter: "all",
    });
    expect(interested.map((client) => client.lead_temperature)).toEqual([
      "hot",
      "lukewarm",
    ]);
  });

  it("combines stage and temperature filters independently", () => {
    const result = filterPipelineClients(clients, {
      query: "",
      statusFilter: "interested",
      temperatureFilter: "lukewarm",
      healthCheckFilter: "all",
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.business_name).toBe("Oak Tree Golf");
  });

  it("does not match stored temperature when the status hides it", () => {
    const clientsWithHiddenHot = [
      ...clients,
      record({
        id: "4",
        business_name: "Hidden Hot",
        status: "potential",
        lead_temperature: "hot",
      }),
    ];
    const hot = filterPipelineClients(clientsWithHiddenHot, {
      query: "",
      statusFilter: "all",
      temperatureFilter: "hot",
      healthCheckFilter: "all",
    });
    expect(hot.map((client) => client.business_name)).toEqual([
      "Case Freight LLC",
    ]);
  });
});

describe("sortPipelineClients", () => {
  it("sorts by temperature priority: Hot, Warm, Lukewarm, Cold, Unknown", () => {
    const clients = (
      [
        "unknown",
        "cold",
        "hot",
        "lukewarm",
        "warm",
      ] as LeadTemperature[]
    ).map((temperature, index) =>
      record({
        id: String(index),
        business_name: temperature,
        status: "interested",
        lead_temperature: temperature,
      }),
    );

    const sorted = sortPipelineClients(clients, "lead_temperature", "asc");
    expect(sorted.map((client) => client.lead_temperature)).toEqual([
      "hot",
      "warm",
      "lukewarm",
      "cold",
      "unknown",
    ]);
  });
});

describe("formatPipelineDate", () => {
  const now = new Date(2026, 8, 8);

  it("renders today, compact month-day, and missing values", () => {
    expect(formatPipelineDate("2026-09-08", now)).toBe("Today");
    expect(formatPipelineDate("2026-09-11", now)).toBe("Sep 11");
    expect(formatPipelineDate(null, now)).toBe("—");
  });
});
