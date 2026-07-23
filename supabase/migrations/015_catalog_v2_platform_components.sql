-- Catalog v2: Platform Components (what gets built) vs Service Add-ons (recurring services).
-- Simplifies invite onboarding; legacy granular products are deactivated, not deleted.

alter table public.platform_product_catalog
  add column if not exists catalog_kind text not null default 'platform_component'
    check (catalog_kind in ('platform_component', 'service_add_on')),
  add column if not exists category_group text,
  add column if not exists capabilities text[] not null default '{}',
  add column if not exists suggested_add_on_price_cents integer
    check (
      suggested_add_on_price_cents is null
      or suggested_add_on_price_cents >= 0
    ),
  add column if not exists supports_quantity boolean not null default false;

-- Deactivate implementation-detail products (capabilities live on parent components).
update public.platform_product_catalog
set is_active = false
where product_key in (
  'hosting',
  'domain_management',
  'email_setup',
  'scheduling',
  'customer_crm',
  'staff_portal',
  'memberships',
  'reporting',
  'inventory',
  'forms',
  'analytics',
  'seo',
  'email_marketing',
  'pos'
);

-- ---------------------------------------------------------------------------
-- Platform components (selectable in invite UI)
-- ---------------------------------------------------------------------------

insert into public.platform_product_catalog (
  product_key,
  name,
  description,
  category,
  category_group,
  capabilities,
  sort_order,
  catalog_kind,
  is_paid_add_on,
  is_active
) values
  (
    'website',
    'Website',
    'Responsive website with hosting, SSL, forms, basic SEO, analytics, and maintenance.',
    'core',
    'core_digital_presence',
    array[
      'Responsive website',
      'Hosting',
      'SSL',
      'Domain connection',
      'DNS',
      'Forms',
      'Basic SEO',
      'Analytics',
      'Security updates',
      'Maintenance',
      'Deployments'
    ],
    10,
    'platform_component',
    false,
    true
  ),
  (
    'client_portal',
    'Client Portal',
    'Customer-facing portal with CRM, reporting, staff tools, and dashboards.',
    'platform',
    'business_platform',
    array[
      'Customer CRM',
      'Reporting',
      'Staff portal',
      'Memberships (if enabled)',
      'Forms',
      'Dashboard'
    ],
    20,
    'platform_component',
    false,
    true
  ),
  (
    'online_booking',
    'Online Booking',
    'Scheduling, calendar, appointments, and availability.',
    'operations',
    'operations',
    array[
      'Scheduling',
      'Calendar',
      'Appointments',
      'Availability'
    ],
    30,
    'platform_component',
    false,
    true
  ),
  (
    'stripe_payments',
    'Stripe Payments',
    'Accept payments online.',
    'payments',
    'payments',
    '{}',
    40,
    'platform_component',
    false,
    true
  ),
  (
    'blog',
    'Blog',
    'Content publishing and blog management.',
    'marketing',
    'marketing',
    '{}',
    50,
    'platform_component',
    false,
    true
  ),
  (
    'reviews',
    'Reviews',
    'Review collection and display.',
    'marketing',
    'marketing',
    '{}',
    60,
    'platform_component',
    false,
    true
  ),
  (
    'ai_chatbot',
    'AI Chatbot',
    'AI-powered chat on the website or portal.',
    'ai',
    'ai',
    '{}',
    70,
    'platform_component',
    false,
    true
  ),
  (
    'retail_pos',
    'Retail / POS',
    'Point of sale with inventory and mobile checkout.',
    'commerce',
    'commerce',
    array['POS', 'Inventory', 'Mobile'],
    80,
    'platform_component',
    false,
    true
  ),
  (
    'mobile_app',
    'Mobile App',
    'Native or progressive mobile experience.',
    'commerce',
    'commerce',
    '{}',
    90,
    'platform_component',
    false,
    true
  ),
  (
    'custom_integration',
    'Custom Integration',
    'Third-party system integration.',
    'custom',
    'integrations',
    '{}',
    100,
    'platform_component',
    false,
    true
  ),
  (
    'other',
    'Other',
    'Custom platform component — describe in the offer.',
    'custom',
    'custom',
    '{}',
    110,
    'platform_component',
    false,
    true
  )
on conflict (product_key) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  category_group = excluded.category_group,
  capabilities = excluded.capabilities,
  sort_order = excluded.sort_order,
  catalog_kind = 'platform_component',
  is_paid_add_on = false,
  is_active = true;

-- Remove AI chatbot from paid-only add-on flag (platform component; service billed separately).
update public.platform_product_catalog
set
  is_paid_add_on = false,
  default_add_on_price_cents = null
where product_key = 'ai_chatbot';

-- ---------------------------------------------------------------------------
-- Service add-ons (recurring services — editable price at invite time)
-- ---------------------------------------------------------------------------

insert into public.platform_product_catalog (
  product_key,
  name,
  category,
  category_group,
  sort_order,
  catalog_kind,
  is_paid_add_on,
  default_add_on_price_cents,
  suggested_add_on_price_cents,
  supports_quantity,
  is_active
) values
  -- Marketing
  ('advanced_seo', 'Advanced SEO', 'marketing', 'marketing', 10, 'service_add_on', true, 14900, 14900, false, true),
  ('advanced_aeo', 'Advanced AEO (AI Search Optimization)', 'marketing', 'marketing', 20, 'service_add_on', true, 19900, 19900, false, true),
  ('local_seo', 'Local SEO', 'marketing', 'marketing', 30, 'service_add_on', true, 9900, 9900, false, true),
  ('google_business_profile', 'Google Business Profile Management', 'marketing', 'marketing', 40, 'service_add_on', true, 7900, 7900, false, true),
  ('monthly_content_creation', 'Monthly Content Creation', 'marketing', 'marketing', 50, 'service_add_on', true, 49900, 49900, false, true),
  ('blog_writing', 'Blog Writing', 'marketing', 'marketing', 60, 'service_add_on', true, 29900, 29900, false, true),
  ('reputation_management', 'Reputation Management', 'marketing', 'marketing', 70, 'service_add_on', true, 14900, 14900, false, true),
  ('review_generation_campaigns', 'Review Generation Campaigns', 'marketing', 'marketing', 80, 'service_add_on', true, 9900, 9900, false, true),
  ('utm_campaign_tracking', 'UTM Campaign Tracking', 'marketing', 'marketing', 90, 'service_add_on', true, 4900, 4900, false, true),
  ('conversion_tracking', 'Conversion Tracking', 'marketing', 'marketing', 100, 'service_add_on', true, 4900, 4900, false, true),
  ('heatmaps_visitor_recordings', 'Heatmaps & Visitor Recordings', 'marketing', 'marketing', 110, 'service_add_on', true, 4900, 4900, false, true),
  -- Communication
  ('business_email_setup', 'Business Email Setup', 'communication', 'communication', 10, 'service_add_on', true, 9900, 9900, false, true),
  ('google_workspace_management', 'Google Workspace Management', 'communication', 'communication', 20, 'service_add_on', true, 4900, 4900, false, true),
  ('microsoft_365_management', 'Microsoft 365 Management', 'communication', 'communication', 30, 'service_add_on', true, 4900, 4900, false, true),
  ('sms_notifications', 'SMS Notifications', 'communication', 'communication', 40, 'service_add_on', true, 2900, 2900, false, true),
  ('two_way_sms', 'Two-Way SMS', 'communication', 'communication', 50, 'service_add_on', true, 4900, 4900, false, true),
  ('email_marketing', 'Email Marketing', 'communication', 'communication', 60, 'service_add_on', true, 9900, 9900, false, true),
  ('newsletter_management', 'Newsletter Management', 'communication', 'communication', 70, 'service_add_on', true, 7900, 7900, false, true),
  -- AI services
  ('ai_chatbot_service', 'AI Chatbot', 'ai', 'ai', 10, 'service_add_on', true, 4900, 4900, false, true),
  ('ai_appointment_assistant', 'AI Appointment Assistant', 'ai', 'ai', 20, 'service_add_on', true, 9900, 9900, false, true),
  ('ai_faq_assistant', 'AI FAQ Assistant', 'ai', 'ai', 30, 'service_add_on', true, 4900, 4900, false, true),
  ('ai_lead_qualification', 'AI Lead Qualification', 'ai', 'ai', 40, 'service_add_on', true, 14900, 14900, false, true),
  ('ai_voice_receptionist', 'AI Voice Receptionist', 'ai', 'ai', 50, 'service_add_on', true, 19900, 19900, false, true),
  -- Operations
  ('additional_staff_licenses', 'Additional Staff Licenses', 'operations', 'operations', 10, 'service_add_on', true, 2900, 2900, true, true),
  ('additional_locations', 'Additional Locations', 'operations', 'operations', 20, 'service_add_on', true, 9900, 9900, true, true),
  ('custom_reporting', 'Custom Reporting', 'operations', 'operations', 30, 'service_add_on', true, 14900, 14900, false, true),
  ('data_migration', 'Data Migration', 'operations', 'operations', 40, 'service_add_on', true, 49900, 49900, false, true),
  ('priority_support', 'Priority Support', 'operations', 'operations', 50, 'service_add_on', true, 9900, 9900, false, true),
  ('dedicated_account_manager', 'Dedicated Account Manager', 'operations', 'operations', 60, 'service_add_on', true, 29900, 29900, false, true),
  ('api_integration', 'API Integration', 'operations', 'operations', 70, 'service_add_on', true, 19900, 19900, false, true),
  ('custom_development', 'Custom Development', 'operations', 'operations', 80, 'service_add_on', true, 14900, 14900, false, true),
  -- Commerce
  ('gift_cards', 'Gift Cards', 'commerce', 'commerce', 10, 'service_add_on', true, 2900, 2900, false, true),
  ('loyalty_program', 'Loyalty Program', 'commerce', 'commerce', 20, 'service_add_on', true, 4900, 4900, false, true),
  ('membership_billing', 'Membership Billing', 'commerce', 'commerce', 30, 'service_add_on', true, 4900, 4900, false, true),
  ('online_store', 'Online Store', 'commerce', 'commerce', 40, 'service_add_on', true, 9900, 9900, false, true),
  -- Infrastructure
  ('additional_storage', 'Additional Storage', 'infrastructure', 'infrastructure', 10, 'service_add_on', true, 1900, 1900, true, true),
  ('additional_domains', 'Additional Domains', 'infrastructure', 'infrastructure', 20, 'service_add_on', true, 900, 900, true, true),
  ('custom_email_deliverability', 'Custom Email Deliverability', 'infrastructure', 'infrastructure', 30, 'service_add_on', true, 4900, 4900, false, true),
  -- Custom placeholder (UI uses free-form rows)
  ('other_add_on', 'Other', 'custom', 'custom', 10, 'service_add_on', true, 0, 0, false, true)
on conflict (product_key) do update set
  name = excluded.name,
  category = excluded.category,
  category_group = excluded.category_group,
  sort_order = excluded.sort_order,
  catalog_kind = 'service_add_on',
  is_paid_add_on = true,
  default_add_on_price_cents = excluded.default_add_on_price_cents,
  suggested_add_on_price_cents = excluded.suggested_add_on_price_cents,
  supports_quantity = excluded.supports_quantity,
  is_active = true;

-- Legacy SMS row may still exist as platform_component from 010 — ensure service add-on row wins.
update public.platform_product_catalog
set catalog_kind = 'service_add_on'
where product_key = 'sms_notifications';
