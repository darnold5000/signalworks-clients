import { z } from "zod";
import { PIPELINE_STATUSES } from "@/lib/pipeline/types";

const pipelineStatusSchema = z.enum(
  PIPELINE_STATUSES as [string, ...string[]],
);

export const pipelineClientInputSchema = z
  .object({
    business_name: z.string().trim().min(1, "Business name is required"),
    contact_name: z.string().trim().min(1, "Contact name is required"),
    status: pipelineStatusSchema.default("potential"),
    last_conversation: z.string().trim().max(10000).nullable().optional(),
    plan: z.string().trim().max(5000).nullable().optional(),
  })
  .strict();

export const pipelineStatusUpdateSchema = z.object({
  status: pipelineStatusSchema,
});

export type PipelineClientInput = z.infer<typeof pipelineClientInputSchema>;
