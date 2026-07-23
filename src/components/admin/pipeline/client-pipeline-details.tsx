"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ButtonLink, MetaRow, PageHeader, Panel } from "@/components/ui";
import {
  deletePipelineClient,
  updatePipelineClient,
} from "@/lib/pipeline/clients";
import type { ClientPipelineRecord } from "@/lib/pipeline/types";
import {
  pipelineRecordToInput,
  type PipelineClientInput,
} from "@/lib/pipeline/validation";
import { formatDate, formatDateTime, formatMoney } from "@/lib/utils";
import { ClientPipelineForm } from "./client-pipeline-form";
import { DeleteClientDialog } from "./delete-client-dialog";
import { PipelineSlideOver } from "./pipeline-slide-over";
import { PipelineStatusBadge } from "./pipeline-status-badge";
import { PipelineTagBadges } from "./pipeline-tag-badges";
import { PipelineToastHost, showPipelineToast } from "./pipeline-toast";

export function ClientPipelineDetails({
  client: initialClient,
}: {
  client: ClientPipelineRecord;
}) {
  const router = useRouter();
  const [client, setClient] = useState(initialClient);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleUpdate(data: PipelineClientInput) {
    setSaving(true);
    const result = await updatePipelineClient(client.id, data);
    setSaving(false);
    if (!result.ok) {
      showPipelineToast(result.error, "error");
      throw new Error(result.error);
    }
    setClient(result.data);
    setEditing(false);
    showPipelineToast("Client updated");
    router.refresh();
  }

  async function handleDelete() {
    setDeleting(true);
    const result = await deletePipelineClient(client.id);
    setDeleting(false);
    if (!result.ok) {
      showPipelineToast(result.error, "error");
      return;
    }
    showPipelineToast("Client deleted");
    router.push("/admin/pipeline");
    router.refresh();
  }

  return (
    <>
      <PipelineToastHost />
      <PageHeader
        title={client.business_name}
        description="Pipeline client record"
        actions={
          <>
            <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="text-danger"
              onClick={() => setDeleteOpen(true)}
            >
              Delete
            </Button>
          </>
        }
      />

      <Panel>
        <dl>
          <MetaRow label="Business" value={client.business_name} />
          <MetaRow label="Contact" value={client.contact_name} />
          <MetaRow
            label="Email"
            value={
              client.contact_email ? (
                <a href={`mailto:${client.contact_email}`} className="underline-offset-2 hover:underline">
                  {client.contact_email}
                </a>
              ) : (
                "—"
              )
            }
          />
          <MetaRow label="Phone" value={client.phone || "—"} />
          <MetaRow
            label="Website"
            value={
              client.website_url ? (
                <a
                  href={client.website_url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline-offset-2 hover:underline"
                >
                  {client.website_url}
                </a>
              ) : (
                "—"
              )
            }
          />
          <MetaRow
            label="Tags"
            value={<PipelineTagBadges tags={client.tags} />}
          />
          <MetaRow
            label="Current Status"
            value={<PipelineStatusBadge status={client.status} />}
          />
          <MetaRow
            label="Est. Monthly Value"
            value={
              client.estimated_monthly_value_cents != null
                ? `${formatMoney(client.estimated_monthly_value_cents)}/mo`
                : "—"
            }
          />
          <MetaRow
            label="Next Follow-up"
            value={formatDate(client.next_follow_up_date)}
          />
          <MetaRow
            label="Last Contacted"
            value={formatDateTime(client.last_contacted_at)}
          />
          <MetaRow
            label="Last Conversation"
            value={
              <span className="block max-w-md whitespace-pre-wrap text-left">
                {client.last_conversation || "—"}
              </span>
            }
          />
          <MetaRow
            label="Plan / Next Step"
            value={
              <span className="block max-w-md whitespace-pre-wrap text-left">
                {client.plan || "—"}
              </span>
            }
          />
          <MetaRow label="Created" value={formatDateTime(client.created_at)} />
          <MetaRow label="Last Updated" value={formatDateTime(client.updated_at)} />
        </dl>
      </Panel>

      <p className="mt-6">
        <ButtonLink href="/admin/pipeline" variant="ghost">
          ← Back to pipeline
        </ButtonLink>
      </p>

      <PipelineSlideOver open={editing} title="Edit Client" onClose={() => setEditing(false)}>
        <ClientPipelineForm
          initial={pipelineRecordToInput(client)}
          submitLabel="Save Changes"
          onCancel={() => setEditing(false)}
          onSubmit={handleUpdate}
          loading={saving}
        />
      </PipelineSlideOver>

      <DeleteClientDialog
        open={deleteOpen}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </>
  );
}
