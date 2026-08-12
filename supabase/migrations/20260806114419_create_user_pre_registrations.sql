create table public.user_pre_registrations (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table public.user_pre_registrations enable row level security;

create policy "anon_insert_user_pre_registrations"
  on public.user_pre_registrations
  for insert
  to anon
  with check (true);
