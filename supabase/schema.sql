-- Screenplay Editor — Supabase schema
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard)

create table if not exists public.scripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null default 'Untitled Screenplay',
  title_page jsonb not null default '{}',
  lines jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists scripts_user_id_idx on public.scripts(user_id);
create index if not exists scripts_updated_at_idx on public.scripts(updated_at desc);

alter table public.scripts enable row level security;

create policy "Users read own scripts"
  on public.scripts for select
  using (auth.uid() = user_id);

create policy "Users insert own scripts"
  on public.scripts for insert
  with check (auth.uid() = user_id);

create policy "Users update own scripts"
  on public.scripts for update
  using (auth.uid() = user_id);

create policy "Users delete own scripts"
  on public.scripts for delete
  using (auth.uid() = user_id);

-- Enable realtime for live cross-device updates
alter publication supabase_realtime add table public.scripts;
