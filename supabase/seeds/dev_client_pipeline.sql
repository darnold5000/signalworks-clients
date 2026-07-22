-- Development-only seed for client_pipeline.
-- Run manually in a dev environment after 006_client_pipeline.sql.
-- contact_name uses a visible placeholder until real names are entered.

insert into public.client_pipeline (business_name, contact_name, status, plan)
values
  ('MA5', 'TBD', 'potential', null),
  ('DAWG', 'TBD', 'potential', null),
  ('Zero Limits', 'TBD', 'potential', null),
  ('Market Street', 'TBD', 'potential', null),
  ('Oak Tree Golf', 'TBD', 'potential', null),
  ('Shay''s House of Dolls', 'TBD', 'potential', null),
  ('Cornerstone', 'TBD', 'potential', null);
