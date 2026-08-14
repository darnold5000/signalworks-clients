import { describe, expect, it } from "vitest";
import { extractWebsiteEvidence, tokenize } from "./evidence";
import { classifyKeywordIdea, clusterKeyForKeyword } from "./filter";
import { selectDiscoveryQueries } from "./select";
import type { FilteredCandidate } from "./types";
import { normalizeDemand } from "@/lib/audit/search-demand/normalize";

function idea(keyword: string, volume = 100, isBrand = false) {
  return { keyword, searchVolume: volume, cpc: 1, competition: null, competitionIndex: 20, isBrand };
}

function candidate(keyword: string, tier: 1 | 2 | 3, volume: number): FilteredCandidate {
  return {
    keyword,
    relevanceTier: tier,
    relevanceSource: tier === 1 ? "primary_service" : "website_evidence",
    searchVolume: volume,
    cpc: null,
    competition: null,
    clusterKey: clusterKeyForKeyword(keyword),
    demand: normalizeDemand({ query: keyword, searchVolume: volume, checkedAt: "now" }),
  };
}

const gymnasticsHtml = `
  <title>Flip Zone | Kids Gymnastics</title>
  <h1>Gymnastics Classes</h1>
  <h2>Tumbling</h2>
  <h2>Preschool Gymnastics</h2>
  <nav><a href="/gymnastics-classes">Gymnastics Classes</a><a href="/tumbling">Tumbling</a></nav>
  <script type="application/ld+json">{"@type":"LocalBusiness","name":"Flip Zone","description":"Kids gymnastics and tumbling classes"}</script>
`;

describe("website evidence filtering", () => {
  it("does not treat gymnastics as a gym via substring matching", () => {
    expect(tokenize("gymnastics").includes("gym")).toBe(false);
    const evidence = extractWebsiteEvidence(gymnasticsHtml);
    expect(evidence.allTokens.has("gymnastics")).toBe(true);
    expect(evidence.allTokens.has("gym")).toBe(false);
    expect(classifyKeywordIdea({ idea: idea("gym"), evidence, businessName: "Flip Zone", city: "Indianapolis", state: "Indiana" })).toEqual({ rejectedReason: "unsupported_by_evidence" });
  });

  it("keeps gymnastics terms and rejects unrelated fitness terms", () => {
    const evidence = extractWebsiteEvidence(gymnasticsHtml);
    expect("candidate" in classifyKeywordIdea({ idea: idea("gymnastics classes"), evidence, businessName: "Flip Zone", city: "Indianapolis", state: "Indiana" })).toBe(true);
    expect("candidate" in classifyKeywordIdea({ idea: idea("kids gymnastics"), evidence, businessName: "Flip Zone", city: "Indianapolis", state: "Indiana" })).toBe(true);
    expect("candidate" in classifyKeywordIdea({ idea: idea("tumbling classes"), evidence, businessName: "Flip Zone", city: "Indianapolis", state: "Indiana" })).toBe(true);
    expect(classifyKeywordIdea({ idea: idea("personal trainer", 10000), evidence, businessName: "Flip Zone", city: "Indianapolis", state: "Indiana" })).toEqual({ rejectedReason: "unsupported_by_evidence" });
    expect(classifyKeywordIdea({ idea: idea("fitness classes", 8000), evidence, businessName: "Flip Zone", city: "Indianapolis", state: "Indiana" })).toEqual({ rejectedReason: "unsupported_by_evidence" });
  });

  it("rejects brand-containing and location-appended keywords", () => {
    const evidence = extractWebsiteEvidence(gymnasticsHtml);
    expect(classifyKeywordIdea({ idea: idea("flip zone gymnastics"), evidence, businessName: "Flip Zone", city: "Indianapolis", state: "Indiana" })).toEqual({ rejectedReason: "brand" });
    expect(classifyKeywordIdea({ idea: idea("gymnastics", 100, true), evidence, businessName: "Flip Zone", city: "Indianapolis", state: "Indiana" })).toEqual({ rejectedReason: "brand" });
    expect(classifyKeywordIdea({ idea: idea("gymnastics classes indianapolis"), evidence, businessName: "Flip Zone", city: "Indianapolis", state: "Indiana" })).toEqual({ rejectedReason: "location_appended" });
  });

  it("keeps roofing, wedding venue, and music teacher terms from website evidence", () => {
    const roof = extractWebsiteEvidence(`<title>Roof Repair</title><h1>Roofing</h1><h2>Roof Replacement</h2>`);
    expect("candidate" in classifyKeywordIdea({ idea: idea("roof repair"), evidence: roof, businessName: "Summit Roofing", city: "Indianapolis", state: "Indiana" })).toBe(true);
    expect("candidate" in classifyKeywordIdea({ idea: idea("roofing"), evidence: roof, businessName: "Summit Roofing", city: "Indianapolis", state: "Indiana" })).toBe(true);
    const wedding = extractWebsiteEvidence(`<title>Wedding Venue</title><h1>Wedding Venue</h1><h2>Ceremony Gardens</h2>`);
    expect("candidate" in classifyKeywordIdea({ idea: idea("wedding venue"), evidence: wedding, businessName: "Garden Hall", city: "Indianapolis", state: "Indiana" })).toBe(true);
    const music = extractWebsiteEvidence(`<title>Piano Lessons</title><h1>Music Teacher</h1><h2>Piano Lessons</h2>`);
    expect("candidate" in classifyKeywordIdea({ idea: idea("piano lessons"), evidence: music, businessName: "Keys Studio", city: "Indianapolis", state: "Indiana" })).toBe(true);
  });
  it("keeps basketball primary terms and rejects unsupported strength training", () => {
    const html = `<title>Basketball Training</title><h1>Basketball Training</h1><h2>Youth Basketball</h2>`;
    const evidence = extractWebsiteEvidence(html);
    expect("candidate" in classifyKeywordIdea({ idea: idea("basketball training"), evidence, businessName: "Refined Indiana", city: "Indianapolis", state: "Indiana" })).toBe(true);
    expect(classifyKeywordIdea({ idea: idea("strength training", 9000), evidence, businessName: "Refined Indiana", city: "Indianapolis", state: "Indiana" })).toEqual({ rejectedReason: "unsupported_by_evidence" });
  });
});

describe("discovery query selection", () => {
  it("does not fill slots with near-duplicate gymnastics class variants", () => {
    const selected = selectDiscoveryQueries([
      candidate("gymnastics classes", 1, 500),
      candidate("gymnastics lessons", 1, 400),
      candidate("gymnastics training", 1, 300),
      candidate("kids gymnastics", 2, 200),
      candidate("tumbling classes", 3, 150),
      candidate("preschool gymnastics", 2, 120),
    ], 6);
    expect(selected.map((item) => item.query)).toEqual([
      "gymnastics classes",
      "kids gymnastics",
      "preschool gymnastics",
      "tumbling classes",
    ]);
    expect(selected.some((item) => item.query === "gymnastics lessons")).toBe(false);
  });

  it("does not choose highest-volume unrelated terms over primary service", () => {
    const selected = selectDiscoveryQueries([
      candidate("basketball training", 1, 40),
      candidate("basketball lessons", 2, 30),
      candidate("youth basketball", 2, 20),
    ], 6);
    expect(selected[0]?.query).toBe("basketball training");
  });
});
