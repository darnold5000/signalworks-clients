import { describe, expect, it } from "vitest";
import { getPortalInviteDisplay } from "./portal-invite-status";
import type { TenantActivityLogEntry } from "@/lib/database/phase1-types";

const baseActivity = (action: string, created_at: string): TenantActivityLogEntry =>
  ({
    id: "1",
    tenant_id: "t1",
    action,
    created_at,
    metadata: {},
    actor_user_id: null,
    subject_type: null,
    subject_id: null,
    summary: null,
  }) as TenantActivityLogEntry;

describe("getPortalInviteDisplay", () => {
  it("shows portal active when owner signed in", () => {
    const result = getPortalInviteDisplay({
      profile: null,
      owner: { email: "a@b.com", hasSignedIn: true },
      activity: [],
    });
    expect(result?.label).toBe("Portal active");
    expect(result?.tone).toBe("success");
  });

  it("shows invite sent from invite.email_sent activity", () => {
    const result = getPortalInviteDisplay({
      profile: { internal_status: "invited" } as never,
      owner: { email: "a@b.com", hasSignedIn: false },
      activity: [
        baseActivity("invite.email_sent", "2026-01-15T12:00:00.000Z"),
      ],
    });
    expect(result?.label).toBe("Invite sent");
    expect(result?.detail).toContain("Last invite email");
  });

  it("returns null when no invite signals", () => {
    const result = getPortalInviteDisplay({
      profile: { internal_status: "active" } as never,
      owner: null,
      activity: [],
    });
    expect(result).toBeNull();
  });
});
