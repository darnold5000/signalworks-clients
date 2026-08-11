insert into storage.buckets (id, name, public)
values ('audit-search-evidence', 'audit-search-evidence', false)
on conflict (id) do update set public = false;
