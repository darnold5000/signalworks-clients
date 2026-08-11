import { afterEach, describe, expect, it, vi } from "vitest";
import { matchGoogleAdsLocation, matchGoogleAdsLocations, resolveGoogleAdsLocation } from "./location";

const catalog = [
  { location_code: 1017146, location_name: "Indianapolis,Indiana,United States", country_iso_code: "US", location_type: "City" },
];

describe("DataForSEO location catalogs", () => {
  afterEach(() => {
    delete process.env.DATAFORSEO_LOGIN;
    delete process.env.DATAFORSEO_PASSWORD;
  });
  it.each([
    ["Indianapolis", "IN"],
    ["Indianapolis", "Indiana"],
    ["indianapolis", "indiana"],
  ])("normalizes %s, %s to the city match", (city, state) => {
    const location = matchGoogleAdsLocation(catalog, { city, state });
    expect(location).toEqual({
      locationCode: 1017146,
      locationName: "Indianapolis,Indiana,United States",
      countryIsoCode: "US",
      locationType: "City",
    });
  });

  it("keeps the Google Ads catalog code independent from the SERP catalog code", () => {
    const location = matchGoogleAdsLocation([{ location_code: 2001001, location_name: "Indianapolis,Indiana,United States", country_iso_code: "US", location_type: "City" }], { city: "Indianapolis", state: "IN" });
    expect(location?.locationCode).toBe(2001001);
    expect(location?.locationCode).not.toBe(1017146);
  });

  it("requires a city and never silently selects the United States", () => {
    expect(matchGoogleAdsLocation(catalog, { city: null, state: "IN" })).toBeNull();
    expect(matchGoogleAdsLocation(catalog, { city: "Indiana", state: null })).toBeNull();
  });

  it("does not choose an ambiguous city without a state", () => {
    const locations = [
      { location_code: 1, location_name: "Plainfield,Indiana,United States", country_iso_code: "US", location_type: "City" },
      { location_code: 2, location_name: "Plainfield,Illinois,United States", country_iso_code: "US", location_type: "City" },
    ];
    expect(matchGoogleAdsLocations(locations, { city: "Plainfield", state: null })).toHaveLength(2);
    expect(matchGoogleAdsLocation(locations, { city: "Plainfield", state: null })).toBeNull();
  });

  it("reports missing provider credentials as a provider error", async () => {
    delete process.env.DATAFORSEO_LOGIN;
    delete process.env.DATAFORSEO_PASSWORD;
    const result = await resolveGoogleAdsLocation({ city: "Indianapolis", state: "Indiana", requestedMarket: "Indianapolis, Indiana", auditId: "location-auth-test" });
    expect(result.status).toBe("provider_error");
    expect(result.location).toBeNull();
  });

  it("distinguishes provider authentication failure from a no-match", async () => {
    process.env.DATAFORSEO_LOGIN = "api-login";
    process.env.DATAFORSEO_PASSWORD = "api-password";
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 401 } as Response);

    const result = await resolveGoogleAdsLocation({ city: "Indianapolis", state: "Indiana", requestedMarket: "Indianapolis, Indiana", auditId: "location-auth-failure-test" });

    expect(result.status).toBe("provider_error");
    expect(result.error).toContain("401");
  });

  it("uses server-side Basic Auth for the Google Ads catalog request", async () => {
    process.env.DATAFORSEO_LOGIN = "api-login";
    process.env.DATAFORSEO_PASSWORD = "api-password";
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ status_code: 20000, tasks: [{ status_code: 20000, result: catalog }] }),
    } as Response);

    const result = await resolveGoogleAdsLocation({ city: "Indianapolis", state: "Indiana", requestedMarket: "Indianapolis, Indiana", auditId: "location-auth-header-test" });

    expect(result.status).toBe("resolved");
    expect(fetch).toHaveBeenCalledWith(
      "https://api.dataforseo.com/v3/keywords_data/google_ads/locations/us",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from("api-login:api-password").toString("base64")}`,
        }),
      }),
    );
  });
});
