-- School Hub database setup (all migrations combined). Paste into Supabase → SQL Editor → Run, once, on a new project.
-- School Hub core schema.
-- Every family-owned table carries family_id and is protected by Row Level
-- Security: a signed-in user can only touch rows of families they belong to.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- enums
create type public.member_role as enum ('owner', 'parent');
create type public.item_kind as enum ('event', 'task', 'announcement');
create type public.item_category as enum (
  'general', 'closure', 'early_dismissal', 'supplies', 'permission_form',
  'payment', 'lunch', 'teacher_request', 'activity', 'reminder'
);
create type public.channel as enum ('upload', 'paste', 'share', 'gmail', 'sms', 'manual');
create type public.document_status as enum ('pending', 'processing', 'needs_review', 'done', 'failed', 'ignored');
create type public.candidate_status as enum ('pending', 'approved', 'rejected');

-- ---------------------------------------------------------------- families
create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  timezone text not null default 'America/New_York',
  -- Secret used in the calendar subscription URL. Rotatable.
  calendar_token text not null default encode(gen_random_bytes(24), 'hex') unique,
  -- Raw source files older than this are purged by the retention job (null = keep).
  document_retention_days int check (document_retention_days is null or document_retention_days >= 7),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.family_members (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'parent',
  display_name text not null check (char_length(display_name) between 1 and 60),
  email text not null,
  digest_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (family_id, user_id)
);
create index on public.family_members (user_id);

-- Is the current user a member of this family? SECURITY DEFINER avoids RLS
-- recursion on family_members. search_path pinned for safety.
create or replace function public.is_family_member(fid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.family_members m where m.family_id = fid and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_family_owner(fid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.family_members m
    where m.family_id = fid and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

create table public.family_invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- schools & children
create table public.schools (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  short_name text,
  created_at timestamptz not null default now()
);
create index on public.schools (family_id);

create table public.children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 40),
  grade text,
  school_id uuid references public.schools(id) on delete set null,
  -- Other names the AI may see: nicknames, teacher names, classroom names.
  aliases text[] not null default '{}',
  color text not null default 'violet',
  created_at timestamptz not null default now()
);
create index on public.children (family_id);

-- School platforms the family uses (MySchoolBucks, Remind, ...). Family-reported;
-- describes how their information can reach School Hub, not a live connection.
create table public.family_platforms (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  platform_key text not null,
  child_ids uuid[] not null default '{}',
  notification_channels text[] not null default '{}', -- email | sms | push | app
  notes text,
  created_at timestamptz not null default now(),
  unique (family_id, platform_key)
);

-- Gmail sender rules: which senders count as school mail, and hints for matching.
create table public.sender_rules (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  pattern text not null check (char_length(pattern) between 3 and 200), -- email or @domain
  platform_key text,
  child_id uuid references public.children(id) on delete set null,
  school_id uuid references public.schools(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (family_id, pattern)
);

-- ---------------------------------------------------------------- ingestion
create table public.source_documents (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  batch_id uuid not null default gen_random_uuid(),
  channel public.channel not null,
  -- Provider-side identifier (Gmail message id, Twilio SID) for idempotent ingestion.
  origin_ref text,
  content_hash text not null,
  title text,
  sender text,
  platform_key text,
  mime_type text,
  storage_path text,
  text_content text,
  child_hint_id uuid references public.children(id) on delete set null,
  school_hint_id uuid references public.schools(id) on delete set null,
  received_at timestamptz not null default now(),
  submitted_by uuid references auth.users(id) on delete set null,
  status public.document_status not null default 'pending',
  error text,
  ai_summary text,
  is_school_related boolean,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.source_documents (family_id, created_at desc);
create index on public.source_documents (batch_id);
create unique index source_documents_origin_uq on public.source_documents (family_id, channel, origin_ref) where origin_ref is not null;
create unique index source_documents_hash_uq on public.source_documents (family_id, content_hash);

-- AI-extracted items awaiting parent review.
create table public.extraction_candidates (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  document_id uuid not null references public.source_documents(id) on delete cascade,
  position int not null default 0,
  kind public.item_kind not null,
  category public.item_category not null default 'general',
  title text not null,
  details text,
  child_id uuid references public.children(id) on delete set null,
  school_id uuid references public.schools(id) on delete set null,
  starts_at timestamptz,
  ends_at timestamptz,
  all_day boolean not null default false,
  due_at timestamptz,
  location text,
  amount_cents int,
  evidence text,
  needs_review boolean not null default false,
  review_reason text,
  duplicate_of uuid,
  status public.candidate_status not null default 'pending',
  created_at timestamptz not null default now()
);
create index on public.extraction_candidates (document_id);
create index on public.extraction_candidates (family_id, status);

-- ---------------------------------------------------------------- items
create table public.items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  kind public.item_kind not null,
  category public.item_category not null default 'general',
  title text not null check (char_length(title) between 1 and 200),
  details text,
  child_id uuid references public.children(id) on delete set null,
  school_id uuid references public.schools(id) on delete set null,
  starts_at timestamptz,
  ends_at timestamptz,
  all_day boolean not null default false,
  due_at timestamptz,
  location text,
  amount_cents int,
  assignee_id uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'event' or starts_at is not null)
);
create index on public.items (family_id, starts_at);
create index on public.items (family_id, due_at);
create index on public.items (family_id, created_at desc);

alter table public.extraction_candidates
  add constraint extraction_candidates_duplicate_fk foreign key (duplicate_of) references public.items(id) on delete set null;

-- Provenance: which source documents an item came from (several when merged).
create table public.item_sources (
  item_id uuid not null references public.items(id) on delete cascade,
  document_id uuid not null references public.source_documents(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  evidence text,
  created_at timestamptz not null default now(),
  primary key (item_id, document_id)
);
create index on public.item_sources (document_id);

-- ---------------------------------------------------------------- integrations
-- Non-secret connection metadata, visible to family members.
create table public.gmail_connections (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  google_email text not null,
  status text not null default 'connected', -- connected | error | revoked
  last_sync_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  messages_seen int not null default 0,
  created_at timestamptz not null default now(),
  unique (family_id, user_id)
);

-- Secrets (encrypted OAuth refresh tokens). RLS on with NO policies:
-- only the server's service role can read or write.
create table public.integration_secrets (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  kind text not null,
  owner_ref uuid not null, -- e.g. gmail_connections.id
  ciphertext text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, owner_ref)
);

-- Phone numbers allowed to text school messages into a family.
create table public.member_phones (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  phone_e164 text unique,              -- set once verified
  verification_code text,              -- user texts this code to School Hub
  code_expires_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

-- Personal ingest tokens (iOS Shortcut / share). Only hashes are stored.
create table public.ingest_tokens (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'iPhone Shortcut',
  token_hash text not null unique,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  family_id uuid references public.families(id) on delete cascade,
  user_id uuid,
  action text not null,
  target text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.audit_events (family_id, created_at desc);

-- ---------------------------------------------------------------- RLS
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.family_invites enable row level security;
alter table public.schools enable row level security;
alter table public.children enable row level security;
alter table public.family_platforms enable row level security;
alter table public.sender_rules enable row level security;
alter table public.source_documents enable row level security;
alter table public.extraction_candidates enable row level security;
alter table public.items enable row level security;
alter table public.item_sources enable row level security;
alter table public.gmail_connections enable row level security;
alter table public.integration_secrets enable row level security;
alter table public.member_phones enable row level security;
alter table public.ingest_tokens enable row level security;
alter table public.audit_events enable row level security;

create policy families_select on public.families for select using (public.is_family_member(id));
create policy families_update on public.families for update using (public.is_family_owner(id)) with check (public.is_family_owner(id));
create policy families_delete on public.families for delete using (public.is_family_owner(id));

create policy members_select on public.family_members for select using (public.is_family_member(family_id));
create policy members_update_self on public.family_members for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy members_delete on public.family_members for delete
  using (user_id = auth.uid() or public.is_family_owner(family_id));

create policy invites_select on public.family_invites for select using (public.is_family_member(family_id));
create policy invites_insert on public.family_invites for insert
  with check (public.is_family_member(family_id) and invited_by = auth.uid());
create policy invites_delete on public.family_invites for delete using (public.is_family_member(family_id));

-- Generic "family members have full access" policies.
do $$
declare t text;
begin
  foreach t in array array['schools','children','family_platforms','sender_rules','source_documents',
                           'extraction_candidates','items','item_sources']
  loop
    execute format('create policy %1$s_all on public.%1$s for all using (public.is_family_member(family_id)) with check (public.is_family_member(family_id))', t);
  end loop;
end $$;

create policy gmail_select on public.gmail_connections for select using (public.is_family_member(family_id));
create policy gmail_delete on public.gmail_connections for delete using (user_id = auth.uid());

create policy phones_select on public.member_phones for select using (public.is_family_member(family_id));
create policy phones_delete on public.member_phones for delete using (user_id = auth.uid());

create policy tokens_select on public.ingest_tokens for select using (user_id = auth.uid());
create policy tokens_delete on public.ingest_tokens for delete using (user_id = auth.uid());

create policy audit_select on public.audit_events for select using (public.is_family_member(family_id));
create policy audit_insert on public.audit_events for insert
  with check (public.is_family_member(family_id) and user_id = auth.uid());

-- Keep items.updated_at fresh.
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger items_touch before update on public.items for each row execute function public.touch_updated_at();

-- Items must reference children/schools of the same family (defense in depth).
create or replace function public.check_item_refs() returns trigger language plpgsql as $$
begin
  if new.child_id is not null and not exists (select 1 from public.children c where c.id = new.child_id and c.family_id = new.family_id) then
    raise exception 'child does not belong to family';
  end if;
  if new.school_id is not null and not exists (select 1 from public.schools s where s.id = new.school_id and s.family_id = new.family_id) then
    raise exception 'school does not belong to family';
  end if;
  return new;
end $$;
create trigger items_refs before insert or update on public.items for each row execute function public.check_item_refs();
create trigger candidates_refs before insert or update on public.extraction_candidates for each row execute function public.check_item_refs();

create or replace function public.check_child_school() returns trigger language plpgsql as $$
begin
  if new.school_id is not null and not exists (select 1 from public.schools s where s.id = new.school_id and s.family_id = new.family_id) then
    raise exception 'school does not belong to family';
  end if;
  return new;
end $$;
create trigger children_school before insert or update on public.children for each row execute function public.check_child_school();

-- Assignee must be a member of the family.
create or replace function public.check_item_assignee() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.assignee_id is not null and not exists (
    select 1 from public.family_members m where m.family_id = new.family_id and m.user_id = new.assignee_id) then
    raise exception 'assignee is not a family member';
  end if;
  return new;
end $$;
create trigger items_assignee before insert or update on public.items for each row execute function public.check_item_assignee();

-- ---------------------------------------------------------------- RPCs
-- Create a family and make the caller its owner (atomic; avoids RLS chicken-and-egg).
create or replace function public.create_family(p_name text, p_timezone text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare fid uuid; uemail text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from family_members where user_id = auth.uid()) then
    raise exception 'already a member of a family';
  end if;
  select email into uemail from auth.users where id = auth.uid();
  insert into families (name, timezone, created_by) values (p_name, p_timezone, auth.uid()) returning id into fid;
  insert into family_members (family_id, user_id, role, display_name, email)
    values (fid, auth.uid(), 'owner', p_display_name, uemail);
  insert into audit_events (family_id, user_id, action) values (fid, auth.uid(), 'family.created');
  return fid;
end $$;

-- Accept an invite. Token is checked by hash; invite email must match the caller.
create or replace function public.accept_invite(p_token text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare inv family_invites; uemail text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into inv from family_invites
    where token_hash = encode(digest(p_token, 'sha256'), 'hex') for update;
  if inv.id is null then raise exception 'invite not found'; end if;
  if inv.accepted_at is not null then raise exception 'invite already used'; end if;
  if inv.expires_at < now() then raise exception 'invite expired'; end if;
  select email into uemail from auth.users where id = auth.uid();
  if lower(uemail) <> lower(inv.email) then raise exception 'invite was sent to a different email address'; end if;
  if exists (select 1 from family_members where user_id = auth.uid()) then
    raise exception 'already a member of a family';
  end if;
  insert into family_members (family_id, user_id, role, display_name, email)
    values (inv.family_id, auth.uid(), 'parent', p_display_name, uemail);
  update family_invites set accepted_at = now(), accepted_by = auth.uid() where id = inv.id;
  insert into audit_events (family_id, user_id, action, target) values (inv.family_id, auth.uid(), 'invite.accepted', inv.email);
  return inv.family_id;
end $$;

-- Look up an invite's family name before accepting (no data beyond the name).
create or replace function public.invite_preview(p_token text)
returns table (family_name text, email text, expired boolean, used boolean)
language sql stable security definer set search_path = public, extensions as $$
  select f.name, i.email, i.expires_at < now(), i.accepted_at is not null
  from family_invites i join families f on f.id = i.family_id
  where i.token_hash = encode(digest(p_token, 'sha256'), 'hex');
$$;

revoke all on function public.create_family(text, text, text) from public, anon;
revoke all on function public.accept_invite(text, text) from public, anon;
revoke all on function public.invite_preview(text) from public, anon;
grant execute on function public.create_family(text, text, text) to authenticated;
grant execute on function public.accept_invite(text, text) to authenticated;
grant execute on function public.invite_preview(text) to authenticated;

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 20971520,
        array['image/jpeg','image/png','image/webp','image/gif','application/pdf'])
on conflict (id) do nothing;

-- Objects live at {family_id}/{document_id}/{filename}.
create policy documents_read on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.is_family_member(((storage.foldername(name))[1])::uuid));
create policy documents_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.is_family_member(((storage.foldername(name))[1])::uuid));
create policy documents_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.is_family_member(((storage.foldername(name))[1])::uuid));

-- Provenance rows and candidates must point at documents/items of the same family.
create or replace function public.check_same_family_document() returns trigger language plpgsql as $$
begin
  if not exists (select 1 from public.source_documents d where d.id = new.document_id and d.family_id = new.family_id) then
    raise exception 'document does not belong to family';
  end if;
  return new;
end $$;
create trigger item_sources_doc before insert or update on public.item_sources for each row execute function public.check_same_family_document();
create trigger candidates_doc before insert or update on public.extraction_candidates for each row execute function public.check_same_family_document();

create or replace function public.check_item_source_item() returns trigger language plpgsql as $$
begin
  if not exists (select 1 from public.items i where i.id = new.item_id and i.family_id = new.family_id) then
    raise exception 'item does not belong to family';
  end if;
  return new;
end $$;
create trigger item_sources_item before insert or update on public.item_sources for each row execute function public.check_item_source_item();

-- Daily digest bookkeeping (one email per member per local day).
alter table public.family_members add column if not exists last_digest_on date;

-- Conversational onboarding: richer school info, family context, web-sourced documents.
alter type public.channel add value if not exists 'web';
alter table public.schools add column if not exists website text;
alter table public.schools add column if not exists calendar_url text;
alter table public.schools add column if not exists town text;
-- What the family told us (how they hear from school, pain points). Used to tailor prompts.
alter table public.families add column if not exists context jsonb not null default '{}';

