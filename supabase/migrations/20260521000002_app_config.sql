-- App-wide configuration values, including the minimum required app version
-- for forced update gating (§34 of spec).
create table if not exists app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- Seed the initial minimum version — "0.0.0" means no gate is active.
insert into app_config (key, value)
values ('minimum_version', '0.0.0')
on conflict (key) do nothing;

-- Public read access (anon + authenticated) — version gate must work before auth.
alter table app_config enable row level security;

create policy "Public read app_config"
  on app_config for select
  using (true);
