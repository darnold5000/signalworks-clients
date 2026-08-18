"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, PageHeader, Panel } from "@/components/ui";
import {
  bulkDeletePipelineClients,
  createPipelineClient,
  deletePipelineClient,
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
import { BulkDeleteClientsDialog } from "./bulk-delete-clients-dialog";
import { DeleteClientDialog } from "./delete-client-dialog";
import { PipelineCard } from "./pipeline-card";
import {
  PipelineFilters,
  type HealthCheckFilter,
} from "./pipeline-filters";
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
    if (sortKey === "last_contacted_at") {
      const aTime = a.last_contacted_at
        ? new Date(a.last_contacted_at).getTime()
        : 0;
      const bTime = b.last_contacted_at
        ? new Date(b.last_contacted_at).getTime()
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
  const [healthCheckFilter, setHealthCheckFilter] =
    useState<HealthCheckFilter>("all");
  const [sortKey, setSortKey] = useState<PipelineSortKey>("updated_at");
  const [sortDirection, setSortDirection] =
    useState<PipelineSortDirection>("desc");
  const [slideOver, setSlideOver] = useState<"add" | "edit" | null>(null);
  const [editingClient, setEditingClient] = useState<ClientPipelineRecord | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [deletingClient, setDeletingClient] =
    useState<ClientPipelineRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = clients.filter((client) => {
      if (statusFilter !== "all" && client.status !== statusFilter) {
        return false;
      }
      if (
        healthCheckFilter === "sent" &&
        !client.health_check_sent
      ) {
        return false;
      }
      if (
        healthCheckFilter === "not_sent" &&
        client.health_check_sent
      ) {
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
  }, [
    clients,
    healthCheckFilter,
    query,
    sortKey,
    sortDirection,
    statusFilter,
  ]);

  const selectedVisibleIds = filtered
    .filter((client) => selectedIds.has(client.id))
    .map((client) => client.id);

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

  function openDelete(client: ClientPipelineRecord) {
    setDeletingClient(client);
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    setSelectedIds(new Set());
  }

  function handleStatusFilterChange(value: "all" | PipelineStatus) {
    setStatusFilter(value);
    setSelectedIds(new Set());
  }

  function handleHealthCheckFilterChange(value: HealthCheckFilter) {
    setHealthCheckFilter(value);
    setSelectedIds(new Set());
  }

  function toggleSelected(id: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      const allSelected =
        filtered.length > 0 &&
        filtered.every((client) => next.has(client.id));
      for (const client of filtered) {
        if (allSelected) next.delete(client.id);
        else next.add(client.id);
      }
      return next;
    });
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

  async function confirmDelete() {
    if (!deletingClient) return;
    setDeleting(true);
    const result = await deletePipelineClient(deletingClient.id);
    setDeleting(false);
    if (!result.ok) {
      showPipelineToast(result.error, "error");
      return;
    }
    setClients((prev) => prev.filter((c) => c.id !== deletingClient.id));
    setSelectedIds((previous) => {
      const next = new Set(previous);
      next.delete(deletingClient.id);
      return next;
    });
    setDeletingClient(null);
    showPipelineToast("Client deleted");
    router.refresh();
  }

  async function confirmBulkDelete() {
    if (selectedVisibleIds.length === 0) return;
    setBulkDeleting(true);
    const result = await bulkDeletePipelineClients(selectedVisibleIds);
    setBulkDeleting(false);
    if (!result.ok) {
      showPipelineToast(result.error, "error");
      return;
    }
    const deleted = new Set(result.data);
    setClients((previous) =>
      previous.filter((client) => !deleted.has(client.id)),
    );
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
    showPipelineToast(
      `${result.data.length} ${result.data.length === 1 ? "client" : "clients"} deleted`,
    );
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
          onQueryChange={handleQueryChange}
          statusFilter={statusFilter}
          onStatusFilterChange={handleStatusFilterChange}
          healthCheckFilter={healthCheckFilter}
          onHealthCheckFilterChange={handleHealthCheckFilterChange}
          resultCount={filtered.length}
          totalCount={clients.length}
        />

        <div className="mt-6 space-y-4">
          {selectedVisibleIds.length > 0 ? (
            <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
              <p className="text-sm text-muted">
                {selectedVisibleIds.length} selected
              </p>
              <Button
                type="button"
                className="bg-danger hover:bg-danger/90"
                onClick={() => setBulkDeleteOpen(true)}
              >
                Delete Selected ({selectedVisibleIds.length})
              </Button>
            </div>
          ) : null}
          <PipelineTable
            clients={filtered}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
            onStatusChange={handleStatusChange}
            statusUpdatingId={statusUpdatingId}
            onEdit={openEdit}
            onDelete={openDelete}
            selectedIds={selectedIds}
            onToggleSelected={toggleSelected}
            onToggleAll={toggleAllVisible}
          />

          <div className="space-y-4">
            {filtered.map((client) => (
              <PipelineCard
                key={client.id}
                client={client}
                onEdit={openEdit}
                onDelete={openDelete}
                onStatusChange={handleStatusChange}
                statusUpdating={statusUpdatingId === client.id}
                selected={selectedIds.has(client.id)}
                onToggleSelected={toggleSelected}
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

      <DeleteClientDialog
        open={Boolean(deletingClient)}
        onCancel={() => setDeletingClient(null)}
        onConfirm={() => void confirmDelete()}
        loading={deleting}
      />
      <BulkDeleteClientsDialog
        open={bulkDeleteOpen}
        count={selectedVisibleIds.length}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={() => void confirmBulkDelete()}
        loading={bulkDeleting}
      />
    </>
  );
}
