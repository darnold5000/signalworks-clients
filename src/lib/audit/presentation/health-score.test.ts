import { describe, expect, it } from "vitest";
import {
  formatConfidenceLabel,
  getScoreConfidence,
} from "@/lib/audit/presentation/health-score";

describe("getScoreConfidence", () => {
  it("maps scored category counts to confidence bands", () => {
    expect(formatConfidenceLabel(getScoreConfidence(10))).toBe("High");
    expect(formatConfidenceLabel(getScoreConfidence(9))).toBe("High");
    expect(formatConfidenceLabel(getScoreConfidence(8))).toBe("Medium");
    expect(formatConfidenceLabel(getScoreConfidence(7))).toBe("Medium");
    expect(formatConfidenceLabel(getScoreConfidence(6))).toBe("Limited");
  });
});
