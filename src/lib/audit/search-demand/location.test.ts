import { describe, expect, it } from "vitest";
import { matchGoogleAdsLocation, matchGoogleAdsLocations } from "./location";

const catalog = [
  { location_code: 1017146, location_name: "Indianapolis,Indiana,United States", country_iso_code: "US", location_type: "City" },
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
});
