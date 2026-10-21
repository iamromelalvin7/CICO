-- CICO schema. Run once in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- Safe to re-run.
--
-- Single user, no accounts: row level security is off and the anon key can read and write
-- (decided in the spec). Rows are never hard-deleted; deleted_at marks a soft delete so a
-- delete made offline still reaches other devices.

create table if not exists public.categories (
  id                uuid primary key,
  name              text not null,
  color_or_icon     text not null,
  is_default        boolean not null default false,
  created_at        timestamptz not null,
  -- Set by the device on every change; last write wins.
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  -- Set by the server on every accepted write; devices pull rows newer than their cursor.
  -- Device clocks can disagree, so they are never used for pulling.
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.transactions (
  id                uuid primary key,
  amount            numeric(14, 2) not null check (amount > 0),
  direction         text not null check (direction in ('income', 'expense')),
  category_id       uuid not null references public.categories (id),
  description       text not null default '',
  occurred_at       timestamptz not null,
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);

create index if not exists categories_server_updated_at_idx
  on public.categories (server_updated_at, id);
create index if not exists transactions_server_updated_at_idx
  on public.transactions (server_updated_at, id);

-- Last write wins: an incoming row only replaces the stored one if its updated_at is newer.
-- Older or identical writes (a stale offline edit, a retried push) are skipped silently.
create or replace function public.cico_last_write_wins()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at <= old.updated_at then
    return null;
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists categories_last_write_wins on public.categories;
create trigger categories_last_write_wins
  before insert or update on public.categories
  for each row execute function public.cico_last_write_wins();

drop trigger if exists transactions_last_write_wins on public.transactions;
create trigger transactions_last_write_wins
  before insert or update on public.transactions
  for each row execute function public.cico_last_write_wins();

alter table public.categories disable row level security;
alter table public.transactions disable row level security;

-- The app only reads, inserts and updates. No delete grant: deletes are soft.
grant select, insert, update on public.categories to anon;
grant select, insert, update on public.transactions to anon;

-- Make the new tables visible to the REST API straight away.
notify pgrst, 'reload schema';
