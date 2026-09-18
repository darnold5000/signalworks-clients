-- Simplified Technology & Services inventory. Existing technical-profile
-- columns remain intact so deprecated UI fields retain all production data.

alter table public.tenant_technical_profiles
  add column if not exists payment_provider text,
  add column if not exists payment_method_notes text,
  add column if not exists sms_provider text,
  add column if not exists twilio_account_sid text,
  add column if not exists twilio_phone_number text,
  add column if not exists twilio_number_type text
    check (
      twilio_number_type is null
      or twilio_number_type in ('toll_free', 'local')
    ),
  add column if not exists sms_enabled boolean;

-- Preserve the useful meaning of existing Stripe configuration.
update public.tenant_technical_profiles
set payment_provider = case
  when stripe_connection_status in ('connected', 'pending')
    or stripe_platform_account_id is not null
    or stripe_connected_account_id is not null
    then 'stripe'
  when stripe_connection_status = 'not_used' then 'none'
  else payment_provider
end
where payment_provider is null;

-- Convert the old Twilio checkbox to the new first-class provider field while
-- leaving the original JSON untouched for historical preservation.
update public.tenant_technical_profiles
set sms_provider = 'twilio'
where sms_provider is null
  and api_integrations -> 'twilio' ->> 'enabled' = 'true';

comment on column public.tenant_technical_profiles.payment_provider is
  'Operational payment provider name: stripe, manual, none, or a custom value.';
comment on column public.tenant_technical_profiles.payment_method_notes is
  'Non-secret operational notes for manual or external payment handling.';
comment on column public.tenant_technical_profiles.twilio_account_sid is
  'Twilio account identifier only. Never store an auth token or API key.';
comment on column public.tenant_technical_profiles.sms_enabled is
  'Whether SMS messaging is enabled for the configured communications provider.';
