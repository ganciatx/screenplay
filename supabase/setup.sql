-- Screenplay Editor — complete Supabase setup (run once)
-- Supabase Dashboard → SQL Editor → New query → paste all → Run

create table if not exists public.scripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null default 'Untitled Screenplay',
  title_page jsonb not null default '{}',
  lines jsonb not null default '[]',
  notes jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists scripts_user_id_idx on public.scripts(user_id);
create index if not exists scripts_updated_at_idx on public.scripts(updated_at desc);

alter table public.scripts enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.scripts to authenticated;

create or replace function public.scripts_set_user_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  new.user_id := auth.uid();
  return new;
end;
$$;

drop trigger if exists scripts_set_user_id on public.scripts;
create trigger scripts_set_user_id
  before insert on public.scripts
  for each row execute function public.scripts_set_user_id();

drop policy if exists "Users read own scripts" on public.scripts;
drop policy if exists "Users insert own scripts" on public.scripts;
drop policy if exists "Users update own scripts" on public.scripts;
drop policy if exists "Users delete own scripts" on public.scripts;

create policy "Users read own scripts"
  on public.scripts for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users insert own scripts"
  on public.scripts for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users update own scripts"
  on public.scripts for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete own scripts"
  on public.scripts for delete
  to authenticated
  using (auth.uid() = user_id);

do $$ begin
  alter publication supabase_realtime add table public.scripts;
exception when duplicate_object then null;
end $$;
