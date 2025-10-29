-- Boost visibility tables and policies
create table if not exists public.bar_boosts (
  id uuid primary key default gen_random_uuid(),
  bar_id uuid not null references public.bars(id) on delete cascade,
  user_id uuid references public.users(id),
  plan text not null check (plan in ('7d','1m','1y')),
  start_at timestamptz not null default now(),
  end_at timestamptz not null,
  status text not null default 'active' check (status in ('active','expired','cancelled')),
  created_at timestamptz not null default now(),
  stripe_session_id text unique,
  stripe_payment_intent_id text,
  amount_cents int not null,
  currency text not null default 'eur'
);

create table if not exists public.boost_payments (
  id uuid primary key default gen_random_uuid(),
  bar_id uuid not null references public.bars(id) on delete cascade,
  user_id uuid references public.users(id),
  stripe_session_id text unique,
  stripe_payment_intent_id text,
  product_id text not null,
  plan text not null check (plan in ('7d','1m','1y')),
  amount_cents int not null,
  currency text not null default 'eur',
  status text not null default 'succeeded',
  created_at timestamptz not null default now()
);

create index if not exists idx_bar_boosts_bar_id on public.bar_boosts(bar_id);
create index if not exists idx_bar_boosts_active on public.bar_boosts(bar_id, end_at) where status = 'active';

alter table public.bar_boosts enable row level security;
alter table public.boost_payments enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='bar_boosts' and policyname='owner_can_select_bar_boosts'
  ) then
    create policy owner_can_select_bar_boosts on public.bar_boosts for select to authenticated
    using (exists (select 1 from public.bars b where b.id = bar_boosts.bar_id and b.owner_id = auth.uid()));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='boost_payments' and policyname='owner_can_select_boost_payments'
  ) then
    create policy owner_can_select_boost_payments on public.boost_payments for select to authenticated
    using (exists (select 1 from public.bars b where b.id = boost_payments.bar_id and b.owner_id = auth.uid()));
  end if;
end $$;


