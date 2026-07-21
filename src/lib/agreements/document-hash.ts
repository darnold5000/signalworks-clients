import { createHash } from "crypto";

export function hashDocumentContent(html: string): string {
  return createHash("sha256").update(html, "utf8").digest("hex");
}
