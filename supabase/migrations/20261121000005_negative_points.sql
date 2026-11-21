-- Points per count value (e.g. {"0": -2, "1": 1, "2": 2, "3": 3}) so a count
-- system can take points away on a rough day. Null = points equal the count.
alter table public.tracking_systems add column if not exists count_points jsonb;
