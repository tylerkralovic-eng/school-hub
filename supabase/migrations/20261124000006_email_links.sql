-- Which mailbox an email came from, so "Open in Gmail" opens the right account.
alter table public.source_documents add column if not exists origin_account text;

-- Pairs a parent said are NOT duplicates, so the cleanup never suggests them again.
create table if not exists public.not_duplicates (
  family_id uuid not null references public.families(id) on delete cascade,
  item_a uuid not null references public.items(id) on delete cascade,
  item_b uuid not null references public.items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_a, item_b)
);
alter table public.not_duplicates enable row level security;
create policy not_duplicates_all on public.not_duplicates for all using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));
