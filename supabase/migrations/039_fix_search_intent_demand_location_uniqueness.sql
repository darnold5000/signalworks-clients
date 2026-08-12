-- Allow the same intent to have separate localized and national demand rows.
-- Existing rows are preserved; only the obsolete uniqueness rule is removed.
alter table public.search_intent_demand
  drop constraint if exists search_intent_demand_normalized_intent_country_code_languag_key,
  drop constraint if exists search_intent_demand_normalized_intent_country_code_language_key,
  drop constraint if exists search_intent_demand_intent_location_key;

alter table public.search_intent_demand
  add constraint search_intent_demand_location_unique
  unique (normalized_intent, country_code, language_code, location_code);

notify pgrst, 'reload schema';
