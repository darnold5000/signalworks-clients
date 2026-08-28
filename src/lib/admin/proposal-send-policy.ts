import type { ClientOfferStatus } from "@/lib/database/phase1-types";

export function proposalCanBeSent(status: ClientOfferStatus): boolean {
  return status === "published" || status === "viewed";
}

export function proposalSendLabel(status: ClientOfferStatus): string {
  if (status === "accepted") return "Agreement Accepted";
  if (status === "purchased") return "Agreement Completed";
  if (status === "viewed") return "Resend agreement";
  return "Send proposal to client";
}

export function proposalSendDisabledReason(status: ClientOfferStatus): string | null {
  if (status === "accepted" || status === "purchased") {
    return "This agreement has already been accepted and cannot be resent.";
  }
  if (!proposalCanBeSent(status)) return "Publish the offer first, then send it.";
  return null;
}
