alter table public.audit_search_visibility
  add column if not exists demand_location_requested text,
  add column if not exists demand_location_canonical text,
  add column if not exists demand_google_ads_location_code integer,
  add column if not exists demand_google_ads_location_name text,
  add column if not exists demand_location_status text,
  add column if not exists demand_location_error text;

update public.search_intent_demand
set demand_level = 'very_low'
where monthly_search_volume = 0
  and demand_level = 'unavailable';
