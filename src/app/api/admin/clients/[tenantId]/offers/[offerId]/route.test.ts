import { beforeEach, describe, expect, it, vi } from "vitest";

const { isPlatformAdmin, maybeSingle, deleteOffer, stripeCancel } = vi.hoisted(
  () => ({
    isPlatformAdmin: vi.fn(),
    maybeSingle: vi.fn(),
    deleteOffer: vi.fn(),
    stripeCancel: vi.fn(),
  }),
);

vi.mock("@/lib/auth", () => ({ isPlatformAdmin }));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ subscriptions: { cancel: stripeCancel } }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle }),
        }),
      }),
      delete: () => ({ eq: deleteOffer }),
    }),
  }),
}));

import { DELETE } from "@/app/api/admin/clients/[tenantId]/offers/[offerId]/route";

describe("DELETE draft offer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isPlatformAdmin.mockResolvedValue(true);
    maybeSingle.mockResolvedValue({ data: { status: "draft" } });
    deleteOffer.mockResolvedValue({ error: null });
  });

  it("deletes only the internal draft and never touches Stripe", async () => {
    const response = await DELETE(new Request("https://example.test"), {
      params: Promise.resolve({ tenantId: "tenant-1", offerId: "offer-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(deleteOffer).toHaveBeenCalledWith("id", "offer-1");
    expect(stripeCancel).not.toHaveBeenCalled();
  });

  it("refuses to delete a purchased offer", async () => {
    maybeSingle.mockResolvedValue({ data: { status: "purchased" } });

    const response = await DELETE(new Request("https://example.test"), {
      params: Promise.resolve({ tenantId: "tenant-1", offerId: "offer-1" }),
    });

    expect(response.status).toBe(400);
    expect(deleteOffer).not.toHaveBeenCalled();
    expect(stripeCancel).not.toHaveBeenCalled();
  });
});
