-- Demo seed for Signal Works portal on shared Dugout Intel (sw_* tables).
-- Create Auth users in the Dashboard first, then link via sw_client_members.

insert into public.sw_clients (
  id,
  slug,
  business_name,
  status,
  website_status,
  website_url,
  domain,
  domain_owner,
  registrar,
  hosting_platform,
  hosting_status,
  ssl_status,
  database_platform,
  plan_name,
  monthly_price_cents,
  intro_price_cents,
  intro_expires_on,
  contract_start_on,
  updates_included_per_month,
  updates_used_this_month,
  last_deployment_at,
  last_backup_at,
  analytics_summary,
  stripe_customer_id,
  stripe_subscription_id,
  stripe_price_id,
  subscription_status,
  current_period_end,
  estimated_infra_cost_cents,
  support_email,
  notes
) values
(
  'a1000000-0000-4000-8000-000000000001',
  'bloom-studio-salon',
  'Bloom Studio Salon',
  'active',
  'live',
  'https://bloomhairstudiosalon.com',
  'bloomhairstudiosalon.com',
  'Client',
  'Cloudflare',
  'Vercel',
  'active',
  'active',
  'Supabase',
  'Launch',
  4900,
  null,
  null,
  '2026-02-14',
  2,
  0,
  now() - interval '3 days',
  now() - interval '1 day',
  '412 visits last 30 days · top page: Services',
  null,
  null,
  null,
  'none',
  null,
  420,
  'hello@hiresignalworks.com',
  'Founding salon client. Prefers text updates over calls.'
),
(
  'a1000000-0000-4000-8000-000000000002',
  'zero-limits-baseball',
  'Zero Limits Baseball',
  'active',
  'live',
  'https://zerolimitsbaseball.com',
  'zerolimitsbaseball.com',
  'Client',
  'Cloudflare',
  'Vercel',
  'active',
  'active',
  'Supabase',
  'Founding Client',
  2500,
  2500,
  '2027-07-01',
  '2025-07-01',
  3,
  1,
  now() - interval '7 days',
  now() - interval '2 days',
  '1.2k visits last 30 days · top page: Schedule',
  null,
  null,
  null,
  'none',
  null,
  420,
  'hello@hiresignalworks.com',
  'Introductory rate through July 2027.'
)
on conflict (id) do nothing;

insert into public.sw_service_requests (
  client_id,
  request_type,
  title,
  description,
  status,
  created_at
) values
(
  'a1000000-0000-4000-8000-000000000001',
  'hours_update',
  'Update Saturday hours',
  'Saturday hours are now 9am–3pm starting next week.',
  'completed',
  now() - interval '12 days'
),
(
  'a1000000-0000-4000-8000-000000000001',
  'new_service',
  'Add balayage package',
  'Please add a Balayage package to the Services page: $185, 2.5 hours.',
  'in_progress',
  now() - interval '2 days'
),
(
  'a1000000-0000-4000-8000-000000000002',
  'scheduling_update',
  'Schedule update',
  'Fall travel ball tryout dates need to be posted on the homepage.',
  'submitted',
  now() - interval '1 day'
);

insert into public.sw_documents (client_id, title, description, file_url) values
(
  'a1000000-0000-4000-8000-000000000001',
  'Website & Support Agreement',
  'Signed service agreement',
  'https://hiresignalworks.com'
),
(
  'a1000000-0000-4000-8000-000000000002',
  'Founding Client Agreement',
  'Introductory pricing terms',
  'https://hiresignalworks.com'
);
