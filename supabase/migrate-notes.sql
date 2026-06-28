-- Add notes column to existing scripts table
-- Run once in Supabase SQL Editor if you already ran setup.sql before notes were added

alter table public.scripts
  add column if not exists notes jsonb not null default '{}';
