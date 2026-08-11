import { describe, expect, it } from "vitest";
import { matchGoogleAdsLocation } from "./location";

const catalog = [
  { location_code: 1017146, location_name: "Indianapolis,Indiana,United States", country_iso_code: "US", location_type: "City" },
  { location_code: 2001001, location_name: "Indianapolis,Indiana,United States", country_iso_code: "US", location_type: "City" },
];

describe("DataForSEO location catalogs", () => {
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
    const location = matchGoogleAdsLocation([catalog[1]], { city: "Indianapolis", state: "IN" });
    expect(location?.locationCode).toBe(2001001);
    expect(location?.locationCode).not.toBe(1017146);
  });

  it("requires a city and never silently selects the United States", () => {
    expect(matchGoogleAdsLocation(catalog, { city: null, state: "IN" })).toBeNull();
    expect(matchGoogleAdsLocation(catalog, { city: "Indiana", state: null })).toBeNull();
  });
});
