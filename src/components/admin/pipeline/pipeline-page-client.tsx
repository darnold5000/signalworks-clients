"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, PageHeader, Panel } from "@/components/ui";
import {
  createPipelineClient,
  updatePipelineClient,
  updatePipelineStatus,
} from "@/lib/pipeline/clients";
import type {
  ClientPipelineRecord,
  PipelineSortDirection,
  PipelineSortKey,
  PipelineStatus,
} from "@/lib/pipeline/types";
import {
  pipelineRecordToInput,
  type PipelineClientInput,
} from "@/lib/pipeline/validation";
import { ClientPipelineForm } from "./client-pipeline-form";
import { PipelineCard } from "./pipeline-card";
import { PipelineFilters } from "./pipeline-filters";
import { PipelineSlideOver } from "./pipeline-slide-over";
import { PipelineTable } from "./pipeline-table";
import { PipelineToastHost, showPipelineToast } from "./pipeline-toast";

function sortClients(
  clients: ClientPipelineRecord[],
  sortKey: PipelineSortKey,
  sortDirection: PipelineSortDirection,
) {
  const sorted = [...clients].sort((a, b) => {
    if (sortKey === "updated_at") {
      return (
        new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
      );
    }
    if (sortKey === "next_follow_up_date") {
      const aTime = a.next_follow_up_date
        ? new Date(a.next_follow_up_date).getTime()
        : 0;
      const bTime = b.next_follow_up_date
        ? new Date(b.next_follow_up_date).getTime()
        : 0;
      return aTime - bTime;
    }
    if (sortKey === "business_name") {
      return a.business_name.localeCompare(b.business_name);
    }
    return a.status.localeCompare(b.status);
  });
  return sortDirection === "desc" ? sorted.reverse() : sorted;
}

export function PipelinePageClient({
  initialClients,
}: {
  initialClients: ClientPipelineRecord[];
}) {
  const router = useRouter();
  const [clients, setClients] = useState(initialClients);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | PipelineStatus>("all");
  const [sortKey, setSortKey] = useState<PipelineSortKey>("updated_at");
  const [sortDirection, setSortDirection] =
    useState<PipelineSortDirection>("desc");
  const [slideOver, setSlideOver] = useState<"add" | "edit" | null>(null);
  const [editingClient, setEditingClient] = useState<ClientPipelineRecord | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = clients.filter((client) => {
      if (statusFilter !== "all" && client.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        client.business_name,
        client.contact_name,
        client.contact_email,
        client.phone,
        client.website_url,
        client.tags.join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
    return sortClients(matched, sortKey, sortDirection);
  }, [clients, query, sortKey, sortDirection, statusFilter]);

  function handleSort(key: PipelineSortKey) {
    if (sortKey === key) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection(key === "updated_at" ? "desc" : "asc");
  }

  function openAdd() {
    setEditingClient(null);
    setSlideOver("add");
  }

  function openEdit(client: ClientPipelineRecord) {
    setEditingClient(client);
    setSlideOver("edit");
  }

  function closeSlideOver() {
    setSlideOver(null);
    setEditingClient(null);
  }

  async function handleCreate(data: PipelineClientInput) {
    setSaving(true);
    const result = await createPipelineClient(data);
    setSaving(false);
    if (!result.ok) {
      showPipelineToast(result.error, "error");
      throw new Error(result.error);
    }
    setClients((prev) =>
      sortClients([result.data, ...prev], "updated_at", "desc"),
    );
    closeSlideOver();
    showPipelineToast("Client added");
    router.refresh();
  }

  async function handleUpdate(data: PipelineClientInput) {
    if (!editingClient) return;
    setSaving(true);
    const result = await updatePipelineClient(editingClient.id, data);
    setSaving(false);
    if (!result.ok) {
      showPipelineToast(result.error, "error");
      throw new Error(result.error);
    }
    setClients((prev) =>
      prev.map((c) => (c.id === result.data.id ? result.data : c)),
    );
    closeSlideOver();
    showPipelineToast("Client updated");
    router.refresh();
  }

  async function handleStatusChange(id: string, status: PipelineStatus) {
    const existing = clients.find((c) => c.id === id);
    if (!existing || existing.status === status) return;

    setStatusUpdatingId(id);
    const result = await updatePipelineStatus(id, status);
    setStatusUpdatingId(null);

    if (!result.ok) {
      showPipelineToast(result.error, "error");
      return;
    }

    setClients((prev) =>
      prev.map((c) => (c.id === id ? result.data : c)),
    );
    showPipelineToast("Status updated");
    router.refresh();
  }

  if (clients.length === 0) {
    return (
      <>
        <PipelineToastHost />
        <PageHeader
          title="Client Pipeline"
          description="Track potential clients, outreach, and next steps."
          actions={
            <Button type="button" onClick={openAdd}>
              Add Client
            </Button>
          }
        />
        <Panel className="text-center">
          <h2 className="font-display text-2xl">No potential clients yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Add businesses you may want to work with and track where they are in
            your outreach process.
          </p>
          <Button type="button" className="mt-6" onClick={openAdd}>
            Add First Client
          </Button>
        </Panel>
        <PipelineSlideOver open={slideOver === "add"} title="Add Client" onClose={closeSlideOver}>
          <ClientPipelineForm
            submitLabel="Add Client"
            onCancel={closeSlideOver}
            onSubmit={handleCreate}
            loading={saving}
          />
        </PipelineSlideOver>
      </>
    );
  }

  return (
    <>
      <PipelineToastHost />
      <PageHeader
        title="Client Pipeline"
        description="Track potential clients, outreach, and next steps."
        actions={
          <Button type="button" onClick={openAdd}>
            Add Client
          </Button>
        }
      />
      <Panel>
        <PipelineFilters
          query={query}
          onQueryChange={setQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          resultCount={filtered.length}
          totalCount={clients.length}
        />

        <div className="mt-6 space-y-4">
          <PipelineTable
            clients={filtered}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
            onStatusChange={handleStatusChange}
            statusUpdatingId={statusUpdatingId}
            onEdit={openEdit}
          />

          <div className="space-y-4">
            {filtered.map((client) => (
              <PipelineCard
                key={client.id}
                client={client}
                onEdit={openEdit}
                onStatusChange={handleStatusChange}
                statusUpdating={statusUpdatingId === client.id}
              />
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              No clients match your filters.
            </p>
          ) : null}
        </div>
      </Panel>

      <PipelineSlideOver
        open={slideOver === "add"}
        title="Add Client"
        onClose={closeSlideOver}
      >
        <ClientPipelineForm
          submitLabel="Add Client"
          onCancel={closeSlideOver}
          onSubmit={handleCreate}
          loading={saving}
        />
      </PipelineSlideOver>

      <PipelineSlideOver
        open={slideOver === "edit" && Boolean(editingClient)}
        title="Edit Client"
        onClose={closeSlideOver}
      >
        {editingClient ? (
          <ClientPipelineForm
            initial={pipelineRecordToInput(editingClient)}
            submitLabel="Save Changes"
            onCancel={closeSlideOver}
            onSubmit={handleUpdate}
            loading={saving}
          />
        ) : null}
      </PipelineSlideOver>
    </>
  );
}
