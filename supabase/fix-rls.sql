-- Fix Row Level Security for the scripts table
-- Run this once in Supabase → SQL Editor → New query → Run

alter table public.scripts enable row level security;

-- Required when the table was created via SQL (not the Table Editor)
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.scripts to authenticated;

-- Always set owner from the signed-in user (prevents spoofed user_id)
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
