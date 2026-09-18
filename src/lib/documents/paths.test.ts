import { describe, expect, it } from "vitest";
import {
  isAllowedExternalDocumentUrl,
  isStorageBackedDocumentFileUrl,
} from "@/lib/documents/paths";

describe("document download URLs", () => {
  it("treats non-http paths as storage-backed", () => {
    expect(
      isStorageBackedDocumentFileUrl("tenant/doc/file.pdf"),
    ).toBe(true);
    expect(
      isStorageBackedDocumentFileUrl("https://evil.example/file.pdf"),
    ).toBe(false);
  });

  it("allowlists Signal Works and Supabase HTTPS hosts", () => {
    expect(
      isAllowedExternalDocumentUrl("https://clients.hiresignalworks.com/x.pdf"),
    ).toBe(true);
    expect(
      isAllowedExternalDocumentUrl(
        "https://xyz.supabase.co/storage/v1/object/public/x.pdf",
      ),
    ).toBe(true);
    expect(isAllowedExternalDocumentUrl("http://hiresignalworks.com/x.pdf")).toBe(
      false,
    );
    expect(isAllowedExternalDocumentUrl("https://evil.example/phish")).toBe(false);
  });
});
