import { describe, expect, it, vi } from "vitest";
import type { createClient } from "@/lib/supabase/server";
import { replaceOfferFeatures } from "@/lib/offers/replace-offer-features";

describe("replaceOfferFeatures", () => {
  it("replaces pasted scope rows on every save without accumulating duplicates", async () => {
    let stored: Array<Record<string, unknown>> = [];
    const remove = vi.fn(() => ({
      eq: async () => {
        stored = [];
        return { error: null };
      },
    }));
    const insert = vi.fn(async (rows: Array<Record<string, unknown>>) => {
      stored = [...rows];
      return { error: null };
    });
    const supabase = {
      from: () => ({ delete: remove, insert }),
    } as unknown as Awaited<ReturnType<typeof createClient>>;

    const firstPaste = Array.from(
      { length: 15 },
      (_, index) => `Deliverable ${index + 1}`,
    );
    await replaceOfferFeatures({
      supabase,
      tenantId: "tenant-1",
      offerId: "offer-1",
      labels: firstPaste,
    });

    const edited = ["Deliverable 3", "Updated deliverable", "Deliverable 1"];
    await replaceOfferFeatures({
      supabase,
      tenantId: "tenant-1",
      offerId: "offer-1",
      labels: edited,
    });

    expect(remove).toHaveBeenCalledTimes(2);
    expect(stored.map((row) => row.label)).toEqual(edited);
    expect(stored.map((row) => row.sort_order)).toEqual([0, 1, 2]);
    expect(stored).toHaveLength(3);
  });
});
