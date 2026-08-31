import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  getOfferWithItems: vi.fn(),
  getTenantOwnerInviteTarget: vi.fn(),
  createProposalPortalLink: vi.fn(),
  deliverClientProposalLink: vi.fn(),
  logTenantActivity: vi.fn(),
  prepareOfferForSend: vi.fn(),
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
vi.mock("@/lib/offers/prepare-offer-for-send", () => ({
  prepareOfferForSend: mocks.prepareOfferForSend,
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
        contactIds: ["contact-1"],
      });

      expect(result).toEqual({
        ok: false,
        error: "This agreement has already been accepted and cannot be resent.",
      });
      expect(mocks.deliverClientProposalLink).not.toHaveBeenCalled();
      expect(mocks.logTenantActivity).not.toHaveBeenCalled();
    },
  );
});

function resolvedQuery<T>(result: T) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "ilike", "maybeSingle", "single", "update", "insert"]) {
    query[method] = vi.fn(() => query);
  }
  query.then = (resolve: (value: T) => unknown) => Promise.resolve(result).then(resolve);
  return query;
}

describe("sendProposalToClient recipient delivery", () => {
  const offer = { id: "offer-1", tenant_id: "tenant-1", title: "Ton Tavern Proposal", status: "published", items: [] };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOfferWithItems.mockResolvedValue(offer);
    mocks.deliverClientProposalLink.mockResolvedValue({ deliveryMethod: "email", emailError: null });
  });

  function arrange(contactCount: number) {
    const contacts = Array.from({ length: contactCount }, (_, index) => ({
      id: `00000000-0000-4000-8000-00000000000${index}`,
      tenant_id: "tenant-1",
      name: index === 0 ? "Jeremy" : "Jane",
      email: index === 0 ? "jeremy@example.com" : "jane@example.com",
    }));
    const recipientInserts: unknown[] = [];
    const recipientUpdates: unknown[] = [];
    const from = vi.fn((table: string) => {
      if (table === "tenant_contacts") return resolvedQuery({ data: contacts, error: null });
      if (table === "tenants") return resolvedQuery({ data: { display_name: "Ton Tavern Fitness" }, error: null });
      if (table === "proposal_recipients") return {
        select: vi.fn(() => resolvedQuery({ data: null, error: null })),
        insert: vi.fn((payload) => { recipientInserts.push(payload); return resolvedQuery({ error: null }); }),
        update: vi.fn((payload) => { recipientUpdates.push(payload); return resolvedQuery({ error: null }); }),
      };
      return resolvedQuery({ data: null, error: null });
    });
    mocks.createServiceClient.mockReturnValue({ from });
    return { contacts, recipientInserts, recipientUpdates, from };
  }

  it.each([1, 2])("sends %i separate recipient email(s) without duplicating the proposal", async (count) => {
    const arranged = arrange(count);
    const result = await sendProposalToClient({ tenantId: "tenant-1", offerId: "offer-1", actorUserId: "admin-1", contactIds: arranged.contacts.map((contact) => contact.id) });
    expect(result.ok).toBe(true);
    expect(mocks.deliverClientProposalLink).toHaveBeenCalledTimes(count);
    expect(arranged.recipientInserts).toHaveLength(count);
    expect(arranged.recipientUpdates).toHaveLength(count);
    expect(arranged.from).not.toHaveBeenCalledWith("client_offers");
    if (result.ok) expect(result.deliveries).toHaveLength(count);
  });
});
