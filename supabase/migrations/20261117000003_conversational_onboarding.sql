-- Conversational onboarding: richer school info, family context, web-sourced documents.
alter type public.channel add value if not exists 'web';
alter table public.schools add column if not exists website text;
alter table public.schools add column if not exists calendar_url text;
alter table public.schools add column if not exists town text;
-- What the family told us (how they hear from school, pain points). Used to tailor prompts.
alter table public.families add column if not exists context jsonb not null default '{}';
