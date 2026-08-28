import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  getOfferWithItems: vi.fn(),
  getTenantOwnerInviteTarget: vi.fn(),
  createProposalPortalLink: vi.fn(),
  deliverClientProposalLink: vi.fn(),
  logTenantActivity: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));
vi.mock("@/lib/offers/queries", () => ({
  getOfferWithItems: mocks.getOfferWithItems,
}));
vi.mock("@/lib/admin/client-invite-link", () => ({
  getTenantOwnerInviteTarget: mocks.getTenantOwnerInviteTarget,
  createProposalPortalLink: mocks.createProposalPortalLink,
  deliverClientProposalLink: mocks.deliverClientProposalLink,
}));
vi.mock("@/lib/activity/log-tenant-activity", () => ({
  logTenantActivity: mocks.logTenantActivity,
}));

import { sendProposalToClient } from "@/lib/admin/send-proposal-service";

describe("sendProposalToClient terminal offer protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createServiceClient.mockReturnValue({});
  });

  it.each(["accepted", "purchased"] as const)(
    "rejects a direct resend attempt for a %s offer before delivery",
    async (status) => {
      mocks.getOfferWithItems.mockResolvedValue({
        id: "offer-1",
        tenant_id: "tenant-1",
        title: "Agreement",
        status,
        items: [],
      });

      const result = await sendProposalToClient({
        tenantId: "tenant-1",
        offerId: "offer-1",
        actorUserId: "admin-1",
      });

      expect(result).toEqual({
        ok: false,
        error: "This agreement has already been accepted and cannot be resent.",
      });
      expect(mocks.getTenantOwnerInviteTarget).not.toHaveBeenCalled();
      expect(mocks.createProposalPortalLink).not.toHaveBeenCalled();
      expect(mocks.deliverClientProposalLink).not.toHaveBeenCalled();
      expect(mocks.logTenantActivity).not.toHaveBeenCalled();
    },
  );
});
