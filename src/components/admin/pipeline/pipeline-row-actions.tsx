"use client";

import { Eye, Pencil, Trash2 } from "lucide-react";
import {
  IconActionButton,
  IconActionLink,
} from "@/components/admin/icon-action-button";
import type { ClientPipelineRecord } from "@/lib/pipeline/types";

export function PipelineRowActions({
  client,
  onEdit,
  onDelete,
}: {
  client: ClientPipelineRecord;
  onEdit: (client: ClientPipelineRecord) => void;
  onDelete: (client: ClientPipelineRecord) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <IconActionLink
        label="View"
        icon={Eye}
        href={`/admin/pipeline/${client.id}`}
      />
      <IconActionButton
        label="Edit"
        icon={Pencil}
        onClick={() => onEdit(client)}
      />
      <IconActionButton
        label="Delete"
        icon={Trash2}
        variant="danger"
        onClick={() => onDelete(client)}
      />
    </div>
  );
}
