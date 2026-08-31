import { describe, expect, it } from "vitest";
import { hashProposalAccessToken } from "@/lib/admin/send-proposal-service";

describe("proposal recipient access tokens", () => {
  it("stores a deterministic hash rather than the recipient's raw token", () => {
    const token = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-";
    const hash = hashProposalAccessToken(token);
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain(token);
    expect(hashProposalAccessToken(token)).toBe(hash);
  });
});
