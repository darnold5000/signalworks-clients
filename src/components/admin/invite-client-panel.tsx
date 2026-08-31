"use client";

import { useState } from "react";
import { CreateClientForm } from "@/components/admin/create-client-form";
import { Button, Panel } from "@/components/ui";

export function InviteClientPanel() {
  const [open, setOpen] = useState(false);

  return (
    <Panel className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-medium">Add client</h2>
          <p className="mt-1 text-sm text-muted">
            Create the business and its contacts. Proposals, portal access, and
            billing are separate actions after the client is saved.
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
          <CreateClientForm onSaved={() => setOpen(false)} />
        </div>
      ) : null}
    </Panel>
  );
}
