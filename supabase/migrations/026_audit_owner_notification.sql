-- Migration 026: durable idempotency marker for health-check owner notifications.

alter table public.audit_requests
  add column if not exists owner_notification_sent_at timestamptz;

comment on column public.audit_requests.owner_notification_sent_at is
  'Set when the internal owner notification has been claimed for delivery. Used to prevent duplicate sends for a completed public audit.';
