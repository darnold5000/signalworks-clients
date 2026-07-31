import type { AuditFindingInput } from "@/lib/audit/types";

type FindingDefaults = {
  sourceType: AuditFindingInput["sourceType"];
  sourceLabel: string;
};

const AUTOMATED: FindingDefaults = {
  sourceType: "automated",
  sourceLabel: "Automated website check",
};

const VERIFIED: FindingDefaults = {
  sourceType: "verified",
  sourceLabel: "Signal Works Operations Inventory",
};

const THIRD_PARTY: FindingDefaults = {
  sourceType: "estimated_third_party",
  sourceLabel: "Google PageSpeed Insights",
};

export function automatedFinding(
  input: Omit<AuditFindingInput, "sourceType" | "sourceLabel">,
): AuditFindingInput {
  return { ...AUTOMATED, ...input };
}

export function verifiedFinding(
  input: Omit<AuditFindingInput, "sourceType" | "sourceLabel">,
): AuditFindingInput {
  return { ...VERIFIED, ...input };
}

export function thirdPartyFinding(
  input: Omit<AuditFindingInput, "sourceType" | "sourceLabel">,
): AuditFindingInput {
  return { ...THIRD_PARTY, ...input };
}
