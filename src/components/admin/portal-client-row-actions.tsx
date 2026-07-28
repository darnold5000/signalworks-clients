"use client";

import { Eye, Pencil } from "lucide-react";
import { IconActionLink } from "@/components/admin/icon-action-button";

export function PortalClientRowActions({ tenantId }: { tenantId: string }) {
  return (
    <div className="flex items-center gap-1">
      <IconActionLink
        label="View client"
        icon={Eye}
        href={`/admin/clients/${tenantId}/overview`}
      />
      <IconActionLink
        label="Edit business profile"
        icon={Pencil}
        href={`/admin/clients/${tenantId}/overview?edit=1#business-profile`}
      />
    </div>
  );
}
