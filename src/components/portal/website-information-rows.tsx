"use client";

import { useState } from "react";
import { MetaRow, StatusPill } from "@/components/ui";
import type { Client } from "@/lib/types";
import {
  WEBSITE_SECURITY_LABELS,
  formatCertExpirySummary,
  resolveWebsiteSecurityStatus,
  websiteSecurityIcon,
  websiteSecurityTone,
} from "@/lib/portal/website-security";
import { formatDateTime } from "@/lib/utils";

export function WebsiteSecurityMetaRow({ client }: { client: Client }) {
  const [open, setOpen] = useState(false);
  const status = resolveWebsiteSecurityStatus(client);
  const label = `${websiteSecurityIcon(status)} ${WEBSITE_SECURITY_LABELS[status]}`;
  const expiryLine = formatCertExpirySummary(
    client.website_security_cert_expires_at,
  );

  const hasDetails =
    client.website_security_https_enabled != null ||
    client.website_security_cert_valid != null ||
    expiryLine != null;

  return (
    <MetaRow
      label="Website security"
      value={
        <div className="text-right sm:text-left">
          <button
            type="button"
            className={
              hasDetails
                ? "inline-flex items-center gap-1 text-left underline-offset-2 hover:underline"
                : "inline-flex items-center gap-1"
            }
            onClick={() => hasDetails && setOpen((v) => !v)}
            aria-expanded={open}
          >
            <StatusPill label={label} tone={websiteSecurityTone(status)} />
          </button>
          {open && hasDetails ? (
            <ul className="mt-2 space-y-1 text-left text-xs text-muted">
              {client.website_security_https_enabled != null ? (
                <li>
                  HTTPS enabled:{" "}
                  {client.website_security_https_enabled ? "Yes" : "No"}
                </li>
              ) : null}
              {client.website_security_cert_valid != null ? (
                <li>
                  SSL certificate valid:{" "}
                  {client.website_security_cert_valid ? "Yes" : "No"}
                </li>
              ) : null}
              {expiryLine ? <li>{expiryLine}</li> : null}
            </ul>
          ) : null}
        </div>
      }
    />
  );
}

export function WebsiteLastUpdateMetaRow({ client }: { client: Client }) {
  const value =
    client.website_last_updated_at ?? client.last_deployment_at ?? null;
  return (
    <MetaRow label="Last update" value={formatDateTime(value) ?? "—"} />
  );
}
