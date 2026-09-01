import { describe, expect, it } from "vitest";
import {
  featureLabelsToScopeText,
  proposalScopeBlocks,
  scopeTextToFeatureLabels,
} from "@/lib/offers/proposal-scope";

describe("proposal scope bulk editing", () => {
  it("round-trips a 15-line pasted scope through feature rows", () => {
    const pasted = Array.from(
      { length: 15 },
      (_, index) => `Deliverable ${index + 1}`,
    ).join("\n");

    const persistedRows = scopeTextToFeatureLabels(pasted);
    const refreshedText = featureLabelsToScopeText(persistedRows);

    expect(persistedRows).toHaveLength(15);
    expect(refreshedText).toBe(pasted);
    expect(new Set(persistedRows).size).toBe(15);
  });

  it("preserves edits, removals, reordering, and paragraph breaks", () => {
    const edited = [
      "Introductory paragraph",
      "",
      "- Booking and scheduling",
      "• Client portal",
      "Owner dashboard",
    ].join("\n");

    const persistedRows = scopeTextToFeatureLabels(edited);

    expect(featureLabelsToScopeText(persistedRows)).toBe(edited);
    expect(proposalScopeBlocks(persistedRows)).toEqual([
      { kind: "prose", lines: ["Introductory paragraph"] },
      {
        kind: "list",
        items: ["Booking and scheduling", "Client portal"],
      },
      { kind: "prose", lines: ["Owner dashboard"] },
    ]);
  });

  it("hydrates existing individual feature rows without changing them", () => {
    const legacyRows = ["Custom website", "Client portal", "Owner dashboard"];

    expect(featureLabelsToScopeText(legacyRows)).toBe(
      "Custom website\nClient portal\nOwner dashboard",
    );
    expect(scopeTextToFeatureLabels(featureLabelsToScopeText(legacyRows))).toEqual(
      legacyRows,
    );
  });
});
