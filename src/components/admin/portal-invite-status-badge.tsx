import { StatusPill } from "@/components/ui";
import type { PortalInviteDisplay } from "@/lib/admin/portal-invite-status";

export function PortalInviteStatusBadge({
  display,
}: {
  display: PortalInviteDisplay | null;
}) {
  if (!display) return null;

  return (
    <div className="flex flex-col gap-0.5">
      <StatusPill label={display.label} tone={display.tone} />
      {display.detail ? (
        <p className="text-xs text-muted">{display.detail}</p>
      ) : null}
    </div>
  );
}
