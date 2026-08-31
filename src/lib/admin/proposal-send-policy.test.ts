import { describe, expect, it } from "vitest";
import {
  proposalCanBeSent,
  proposalSendDisabledReason,
  proposalSendLabel,
} from "@/lib/admin/proposal-send-policy";

describe("proposal send policy", () => {
  it("allows an explicitly selected draft to enter the send workflow", () => {
    expect(proposalCanBeSent("draft")).toBe(true);
    expect(proposalSendDisabledReason("draft")).toBeNull();
  });
  it("allows sending published offers", () => {
    expect(proposalCanBeSent("published")).toBe(true);
    expect(proposalSendDisabledReason("published")).toBeNull();
  });

  it("allows resending viewed offers", () => {
    expect(proposalCanBeSent("viewed")).toBe(true);
    expect(proposalSendLabel("viewed")).toBe("Resend agreement");
  });

  it("disables accepted offers with terminal agreement wording", () => {
    expect(proposalCanBeSent("accepted")).toBe(false);
    expect(proposalSendLabel("accepted")).toBe("Agreement Accepted");
    expect(proposalSendDisabledReason("accepted")).toBe(
      "This agreement has already been accepted and cannot be resent.",
    );
  });

  it("disables purchased offers with completed wording", () => {
    expect(proposalCanBeSent("purchased")).toBe(false);
    expect(proposalSendLabel("purchased")).toBe("Agreement Completed");
  });
});
