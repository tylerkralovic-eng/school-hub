-- Behavior / points tracking: each school's own system (stars, Skittles, …),
-- one entry per child per school day, and prizes to work toward.

create table public.tracking_systems (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  child_id uuid not null unique references public.children(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),         -- "Star chart"
  kind text not null check (kind in ('levels', 'count')),
  -- levels: best first: [{key,label,color,meaning,points}]
  levels jsonb not null default '[]',
  count_max int check (count_max is null or count_max between 1 and 20),  -- count: e.g. 3 Skittles
  count_unit text,                                                          -- "Skittles"
  check_in_time time,                                                       -- local, e.g. 14:30
  description text,                                                         -- what the parent said
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.behavior_entries (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  day date not null,
  level_key text,
  count int,
  points int not null default 0,
  note text check (note is null or char_length(note) <= 500),
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (child_id, day)
);
create index on public.behavior_entries (family_id, day);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  horizon text not null check (horizon in ('week', 'big')),
  title text not null check (char_length(title) between 1 and 80),
  points_goal int not null check (points_goal between 1 and 100000),
  starts_on date not null default current_date,   -- big prizes count points from here
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.rewards (child_id);

alter table public.tracking_systems enable row level security;
alter table public.behavior_entries enable row level security;
alter table public.rewards enable row level security;
create policy tracking_systems_all on public.tracking_systems for all using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));
create policy behavior_entries_all on public.behavior_entries for all using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));
create policy rewards_all on public.rewards for all using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));

-- The child must belong to the row's family.
create or replace function public.check_child_family() returns trigger language plpgsql as $$
begin
  if not exists (select 1 from public.children c where c.id = new.child_id and c.family_id = new.family_id) then
    raise exception 'child does not belong to family';
  end if;
  return new;
end $$;
create trigger tracking_systems_child before insert or update on public.tracking_systems for each row execute function public.check_child_family();
create trigger behavior_entries_child before insert or update on public.behavior_entries for each row execute function public.check_child_family();
create trigger rewards_child before insert or update on public.rewards for each row execute function public.check_child_family();
create trigger tracking_systems_touch before update on public.tracking_systems for each row execute function public.touch_updated_at();
create trigger behavior_entries_touch before update on public.behavior_entries for each row execute function public.touch_updated_at();
