"use client";

import { Eye, FilePlus2, Pencil } from "lucide-react";
import { IconActionLink } from "@/components/admin/icon-action-button";

export function PortalClientRowActions({ tenantId }: { tenantId: string }) {
  return (
    <div className="flex items-center gap-1">
      <IconActionLink
        label="Create proposal"
        icon={FilePlus2}
        href={`/admin/clients/${tenantId}/offers`}
      />
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
