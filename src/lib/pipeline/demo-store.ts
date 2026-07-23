import type { ClientPipelineRecord, PipelineTag } from "@/lib/pipeline/types";

/** Placeholder tenant ID used only when Supabase is not configured. */
export const DEMO_SIGNALWORKS_TENANT_ID =
  "00000000-0000-4000-8000-000000000001";

const now = () => new Date().toISOString();

type DemoPipelinePayload = Omit<
  ClientPipelineRecord,
  "id" | "tenant_id" | "created_at" | "updated_at" | "last_contacted_at"
>;

function initialLastContacted(payload: DemoPipelinePayload): string | null {
  if (payload.last_conversation?.trim()) return now();
  if (payload.status !== "potential") return now();
  return null;
}

let demoRecords: ClientPipelineRecord[] = [
  {
    id: "p1000000-0000-4000-8000-000000000001",
    tenant_id: DEMO_SIGNALWORKS_TENANT_ID,
    business_name: "MA5",
    contact_name: "TBD",
    contact_email: "info@ma5performance.com",
    phone: "(555) 201-4400",
    website_url: "https://ma5performance.com",
    status: "contact_made",
    last_conversation: "Interested in replacing Mindbody for scheduling and billing.",
    plan: "Schedule follow-up meeting",
    estimated_monthly_value_cents: 250000,
    next_follow_up_date: "2026-07-25",
    last_contacted_at: "2026-07-18T14:30:00.000Z",
    tags: ["Gym"],
    created_at: "2026-06-01T12:00:00.000Z",
    updated_at: "2026-07-18T14:30:00.000Z",
  },
  {
    id: "p1000000-0000-4000-8000-000000000002",
    tenant_id: DEMO_SIGNALWORKS_TENANT_ID,
    business_name: "DAWG",
    contact_name: "TBD",
    contact_email: null,
    phone: null,
    website_url: null,
    status: "proposal_sent",
    last_conversation: "Reviewed booking features and parent portal.",
    plan: "Follow up Friday",
    estimated_monthly_value_cents: 180000,
    next_follow_up_date: "2026-07-24",
    last_contacted_at: "2026-07-20T09:00:00.000Z",
    tags: ["Gym"],
    created_at: "2026-05-15T10:00:00.000Z",
    updated_at: "2026-07-20T09:00:00.000Z",
  },
  {
    id: "p1000000-0000-4000-8000-000000000003",
    tenant_id: DEMO_SIGNALWORKS_TENANT_ID,
    business_name: "Zero Limits",
    contact_name: "TBD",
    contact_email: null,
    phone: null,
    website_url: "https://zerolimits.example",
    status: "conversation_ongoing",
    last_conversation: null,
    plan: "Send updated proposal",
    estimated_monthly_value_cents: 320000,
    next_follow_up_date: "2026-07-28",
    last_contacted_at: "2026-07-10T16:00:00.000Z",
    tags: ["Gym", "Other"],
    created_at: "2026-04-01T08:00:00.000Z",
    updated_at: "2026-07-10T16:00:00.000Z",
  },
  {
    id: "p1000000-0000-4000-8000-000000000004",
    tenant_id: DEMO_SIGNALWORKS_TENANT_ID,
    business_name: "Market Street",
    contact_name: "TBD",
    contact_email: null,
    phone: null,
    website_url: null,
    status: "potential",
    last_conversation: null,
    plan: null,
    estimated_monthly_value_cents: null,
    next_follow_up_date: null,
    last_contacted_at: null,
    tags: ["Retail"],
    created_at: "2026-07-01T08:00:00.000Z",
    updated_at: "2026-07-01T08:00:00.000Z",
  },
  {
    id: "p1000000-0000-4000-8000-000000000005",
    tenant_id: DEMO_SIGNALWORKS_TENANT_ID,
    business_name: "Oak Tree Golf",
    contact_name: "TBD",
    contact_email: null,
    phone: "(555) 555-0199",
    website_url: null,
    status: "reached_out",
    last_conversation: null,
    plan: "Send text message",
    estimated_monthly_value_cents: 150000,
    next_follow_up_date: "2026-07-23",
    last_contacted_at: "2026-07-12T11:00:00.000Z",
    tags: ["Golf"],
    created_at: "2026-07-05T08:00:00.000Z",
    updated_at: "2026-07-12T11:00:00.000Z",
  },
  {
    id: "p1000000-0000-4000-8000-000000000006",
    tenant_id: DEMO_SIGNALWORKS_TENANT_ID,
    business_name: "Shay's House of Dolls",
    contact_name: "TBD",
    contact_email: null,
    phone: null,
    website_url: null,
    status: "potential",
    last_conversation: null,
    plan: null,
    estimated_monthly_value_cents: null,
    next_follow_up_date: null,
    last_contacted_at: null,
    tags: ["Retail", "Other"],
    created_at: "2026-07-08T08:00:00.000Z",
    updated_at: "2026-07-08T08:00:00.000Z",
  },
  {
    id: "p1000000-0000-4000-8000-000000000007",
    tenant_id: DEMO_SIGNALWORKS_TENANT_ID,
    business_name: "Cornerstone",
    contact_name: "TBD",
    contact_email: "hello@cornerstone.example",
    phone: null,
    website_url: null,
    status: "potential",
    last_conversation: null,
    plan: null,
    estimated_monthly_value_cents: 95000,
    next_follow_up_date: "2026-08-01",
    last_contacted_at: null,
    tags: ["Financial"],
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
  data: DemoPipelinePayload,
): ClientPipelineRecord {
  const record: ClientPipelineRecord = {
    id: crypto.randomUUID(),
    tenant_id: DEMO_SIGNALWORKS_TENANT_ID,
    ...data,
    tags: data.tags as PipelineTag[],
    last_contacted_at: initialLastContacted(data),
    created_at: now(),
    updated_at: now(),
  };
  demoRecords = [record, ...demoRecords];
  return record;
}

export function demoUpdatePipelineClient(
  id: string,
  data: Partial<DemoPipelinePayload> & { last_contacted_at?: string | null },
): ClientPipelineRecord | null {
  const index = demoRecords.findIndex((r) => r.id === id);
  if (index === -1) return null;
  const updated: ClientPipelineRecord = {
    ...demoRecords[index],
    ...data,
    tags: (data.tags ?? demoRecords[index].tags) as PipelineTag[],
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
