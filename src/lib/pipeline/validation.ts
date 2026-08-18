import { z } from "zod";
import {
  LEGACY_PIPELINE_TAGS,
  PIPELINE_STATUSES,
  PIPELINE_TAGS,
  type ClientPipelineRecord,
  type PipelineTag,
} from "@/lib/pipeline/types";

const pipelineStatusSchema = z.enum(
  PIPELINE_STATUSES as [string, ...string[]],
);

const pipelineTagSchema = z.enum(
  [...PIPELINE_TAGS, ...LEGACY_PIPELINE_TAGS] as [string, ...string[]],
);

function emptyStringToNull(value: unknown) {
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }
  return value;
}

function emptyValueToBlank(value: unknown) {
  return value == null ? "" : value;
}

export const pipelineClientInputSchema = z
  .object({
    business_name: z.preprocess(
      emptyValueToBlank,
      z.string().trim().max(500),
    ),
    contact_name: z.preprocess(
      emptyValueToBlank,
      z.string().trim().max(500),
    ),
    contact_email: z.preprocess(
      emptyStringToNull,
      z.string().email("Invalid email address").max(320).nullable().optional(),
    ),
    phone: z.preprocess(
      emptyStringToNull,
      z.string().trim().max(50).nullable().optional(),
    ),
    website_url: z.preprocess(
      emptyStringToNull,
      z.string().url("Invalid website URL").max(2000).nullable().optional(),
    ),
    status: pipelineStatusSchema.default("potential"),
    last_conversation: z.string().trim().max(10000).nullable().optional(),
    plan: z.string().trim().max(5000).nullable().optional(),
    estimated_monthly_value: z.preprocess(
      emptyStringToNull,
      z.coerce
        .number()
        .min(0, "Value must be zero or greater")
        .nullable()
        .optional(),
    ),
    last_contact_date: z.preprocess(
      emptyStringToNull,
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid last contact date")
        .nullable()
        .optional(),
    ),
    last_contact_date_explicit: z.boolean().default(false),
    health_check_sent: z.boolean().default(false),
    tags: z.array(pipelineTagSchema).max(16).default([]),
  })
  .strict();

export const pipelineStatusUpdateSchema = z.object({
  status: pipelineStatusSchema,
});

export const pipelineLastContactUpdateSchema = z.object({
  last_contact_date: z.preprocess(
    emptyStringToNull,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid last contact date")
      .nullable(),
  ),
});

export type PipelineClientInput = Omit<
  z.infer<typeof pipelineClientInputSchema>,
  "tags"
> & {
  tags: PipelineTag[];
};

export function pipelineRecordToInput(
  record: ClientPipelineRecord,
): PipelineClientInput {
  return {
    business_name: record.business_name,
    contact_name: record.contact_name,
    contact_email: record.contact_email ?? "",
    phone: record.phone ?? "",
    website_url: record.website_url ?? "",
    status: record.status,
    last_conversation: record.last_conversation ?? "",
    plan: record.plan ?? "",
    estimated_monthly_value:
      record.estimated_monthly_value_cents != null
        ? record.estimated_monthly_value_cents / 100
        : null,
    last_contact_date: record.last_contacted_at?.slice(0, 10) ?? "",
    last_contact_date_explicit: false,
    health_check_sent: record.health_check_sent,
    tags: record.tags,
  };
}
