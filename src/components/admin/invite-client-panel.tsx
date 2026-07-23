"use client";

import { useState } from "react";
import type {
  PlatformPlanTemplate,
  PlatformProductCatalogItem,
} from "@/lib/catalog/types";
import { InviteClientForm } from "@/components/invite-client-form";
import { Button, Panel } from "@/components/ui";

export function InviteClientPanel({
  plans,
  platformComponents,
  serviceAddOns,
}: {
  plans: PlatformPlanTemplate[];
  platformComponents: PlatformProductCatalogItem[];
  serviceAddOns: PlatformProductCatalogItem[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Panel className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-medium">Add client</h2>
          <p className="mt-1 text-sm text-muted">
            Invite a new client with a plan, platform components, and service
            add-ons. For existing clients, use Offers → Send proposal.
          </p>
        </div>
        {!open ? (
          <Button type="button" onClick={() => setOpen(true)}>
            Add client
          </Button>
        ) : (
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Close
          </Button>
        )}
      </div>
      {open ? (
        <div className="mt-6 border-t border-border pt-6">
          <InviteClientForm
            plans={plans}
            platformComponents={platformComponents}
            serviceAddOns={serviceAddOns}
          />
        </div>
      ) : null}
    </Panel>
  );
}
