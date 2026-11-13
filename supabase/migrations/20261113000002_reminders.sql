-- Daily digest bookkeeping (one email per member per local day).
alter table public.family_members add column if not exists last_digest_on date;
