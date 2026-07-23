import type { ClientPipelineRecord } from "@/lib/pipeline/types";

/** Placeholder tenant ID used only when Supabase is not configured. */
export const DEMO_SIGNALWORKS_TENANT_ID =
  "00000000-0000-4000-8000-000000000001";

const now = () => new Date().toISOString();

let demoRecords: ClientPipelineRecord[] = [
  {
    id: "p1000000-0000-4000-8000-000000000001",
    tenant_id: DEMO_SIGNALWORKS_TENANT_ID,
    business_name: "MA5",
    contact_name: "TBD",
    status: "contact_made",
    last_conversation: "Interested in replacing Mindbody for scheduling and billing.",
    plan: "Schedule follow-up meeting",
    created_at: "2026-06-01T12:00:00.000Z",
    updated_at: "2026-07-18T14:30:00.000Z",
  },
  {
    id: "p1000000-0000-4000-8000-000000000002",
    tenant_id: DEMO_SIGNALWORKS_TENANT_ID,
    business_name: "DAWG",
    contact_name: "TBD",
    status: "proposal_sent",
    last_conversation: "Reviewed booking features and parent portal.",
    plan: "Follow up Friday",
    created_at: "2026-05-15T10:00:00.000Z",
    updated_at: "2026-07-20T09:00:00.000Z",
  },
  {
    id: "p1000000-0000-4000-8000-000000000003",
    tenant_id: DEMO_SIGNALWORKS_TENANT_ID,
    business_name: "Zero Limits",
    contact_name: "TBD",
    status: "conversation_ongoing",
    last_conversation: null,
    plan: "Send updated proposal",
    created_at: "2026-04-01T08:00:00.000Z",
    updated_at: "2026-07-10T16:00:00.000Z",
  },
  {
    id: "p1000000-0000-4000-8000-000000000004",
    tenant_id: DEMO_SIGNALWORKS_TENANT_ID,
    business_name: "Market Street",
    contact_name: "TBD",
    status: "potential",
    last_conversation: null,
    plan: null,
    created_at: "2026-07-01T08:00:00.000Z",
    updated_at: "2026-07-01T08:00:00.000Z",
  },
  {
    id: "p1000000-0000-4000-8000-000000000005",
    tenant_id: DEMO_SIGNALWORKS_TENANT_ID,
    business_name: "Oak Tree Golf",
    contact_name: "TBD",
    status: "reached_out",
    last_conversation: null,
    plan: "Send text message",
    created_at: "2026-07-05T08:00:00.000Z",
    updated_at: "2026-07-12T11:00:00.000Z",
  },
  {
    id: "p1000000-0000-4000-8000-000000000006",
    tenant_id: DEMO_SIGNALWORKS_TENANT_ID,
    business_name: "Shay's House of Dolls",
    contact_name: "TBD",
    status: "potential",
    last_conversation: null,
    plan: null,
    created_at: "2026-07-08T08:00:00.000Z",
    updated_at: "2026-07-08T08:00:00.000Z",
  },
  {
    id: "p1000000-0000-4000-8000-000000000007",
    tenant_id: DEMO_SIGNALWORKS_TENANT_ID,
    business_name: "Cornerstone",
    contact_name: "TBD",
    status: "potential",
    last_conversation: null,
    plan: null,
    created_at: "2026-07-10T08:00:00.000Z",
    updated_at: "2026-07-10T08:00:00.000Z",
  },
];

function sortByUpdatedDesc(records: ClientPipelineRecord[]) {
  return [...records].sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

export function demoGetPipelineClients(): ClientPipelineRecord[] {
  return sortByUpdatedDesc(demoRecords);
}

export function demoGetPipelineClient(
  id: string,
): ClientPipelineRecord | null {
  return demoRecords.find((r) => r.id === id) ?? null;
}

export function demoCreatePipelineClient(
  data: Omit<ClientPipelineRecord, "id" | "tenant_id" | "created_at" | "updated_at">,
): ClientPipelineRecord {
  const record: ClientPipelineRecord = {
    id: crypto.randomUUID(),
    tenant_id: DEMO_SIGNALWORKS_TENANT_ID,
    ...data,
    created_at: now(),
    updated_at: now(),
  };
  demoRecords = [record, ...demoRecords];
  return record;
}

export function demoUpdatePipelineClient(
  id: string,
  data: Partial<
    Omit<ClientPipelineRecord, "id" | "tenant_id" | "created_at" | "updated_at">
  >,
): ClientPipelineRecord | null {
  const index = demoRecords.findIndex((r) => r.id === id);
  if (index === -1) return null;
  const updated: ClientPipelineRecord = {
    ...demoRecords[index],
    ...data,
    updated_at: now(),
  };
  demoRecords[index] = updated;
  return updated;
}

export function demoDeletePipelineClient(id: string): boolean {
  const before = demoRecords.length;
  demoRecords = demoRecords.filter((r) => r.id !== id);
  return demoRecords.length < before;
}
