import { z } from "zod";
import {
  PIPELINE_STATUSES,
  PIPELINE_TAGS,
  type ClientPipelineRecord,
  type PipelineTag,
} from "@/lib/pipeline/types";

const pipelineStatusSchema = z.enum(
  PIPELINE_STATUSES as [string, ...string[]],
);

const pipelineTagSchema = z.enum(
  PIPELINE_TAGS as unknown as [string, ...string[]],
);

function emptyStringToNull(value: unknown) {
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }
  return value;
}

export const pipelineClientInputSchema = z
  .object({
    business_name: z.string().trim().min(1, "Business name is required"),
    contact_name: z.string().trim().min(1, "Contact name is required"),
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
    estimated_monthly_value: z.coerce
      .number()
      .min(0, "Value must be zero or greater")
      .nullable()
      .optional(),
    next_follow_up_date: z.preprocess(
      emptyStringToNull,
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid follow-up date")
        .nullable()
        .optional(),
    ),
    tags: z.array(pipelineTagSchema).max(8).default([]),
  })
  .strict();

export const pipelineStatusUpdateSchema = z.object({
  status: pipelineStatusSchema,
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
    next_follow_up_date: record.next_follow_up_date ?? "",
    tags: record.tags,
  };
}
