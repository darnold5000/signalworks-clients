"use client";

import { useState } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import {
  IconActionButton,
  IconActionLink,
} from "@/components/admin/icon-action-button";
import { PortalTenantDeleteDialog } from "@/components/admin/portal-tenant-delete-dialog";

export function PortalClientRowActions({
  tenantId,
  slug,
  displayName,
  platformCategory = "services",
}: {
  tenantId: string;
  slug: string;
  displayName: string;
  platformCategory?: string;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
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
        <IconActionButton
          label="Delete client"
          icon={Trash2}
          variant="danger"
          onClick={() => setDeleteOpen(true)}
        />
      </div>
      <PortalTenantDeleteDialog
        open={deleteOpen}
        tenantId={tenantId}
        slug={slug}
        displayName={displayName}
        platformCategory={platformCategory}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  );
}
