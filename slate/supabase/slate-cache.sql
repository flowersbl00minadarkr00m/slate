create extension if not exists pgcrypto;

create table if not exists public.slate_video_cache (
  id text primary key,
  url text not null,
  title text not null,
  channel text,
  description text,
  thumb text,
  published_at timestamptz,
  duration_seconds integer not null default 0,
  view_count bigint not null default 0,
  like_count bigint not null default 0,
  comment_count bigint not null default 0,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.slate_score_cache (
  video_id text not null references public.slate_video_cache(id) on delete cascade,
  goal_id text not null,
  goal_fingerprint text not null,
  goal_name text,
  relevance_score integer not null check (relevance_score between 0 and 100),
  final_score integer not null check (final_score between 0 and 100),
  why text,
  model text not null,
  scored_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (video_id, goal_fingerprint, model)
);

create table if not exists public.slate_runs (
  id uuid primary key default gen_random_uuid(),
  goals jsonb not null,
  channels jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  videos jsonb not null default '[]'::jsonb,
  quota_used integer not null default 0,
  cache_stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists slate_video_cache_fetched_at_idx on public.slate_video_cache (fetched_at desc);
create index if not exists slate_video_cache_view_count_idx on public.slate_video_cache (view_count desc);
create index if not exists slate_score_cache_goal_idx on public.slate_score_cache (goal_fingerprint, model);
create index if not exists slate_runs_created_at_idx on public.slate_runs (created_at desc);

alter table public.slate_video_cache enable row level security;
alter table public.slate_score_cache enable row level security;
alter table public.slate_runs enable row level security;

grant select, insert, update, delete on public.slate_video_cache to service_role;
grant select, insert, update, delete on public.slate_score_cache to service_role;
grant select, insert, update, delete on public.slate_runs to service_role;
