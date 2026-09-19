-- History Learning Platform: core Supabase schema
-- Safe to run more than once. Public access is denied by RLS until server APIs are installed.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.schools (
  id text primary key,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.school_years (
  id uuid primary key default gen_random_uuid(),
  school_id text not null references public.schools(id),
  year integer not null check (year between 2020 and 2200),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, year)
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_year_id uuid not null references public.school_years(id) on delete cascade,
  grade smallint not null check (grade between 1 and 6),
  class_no smallint not null check (class_no between 1 and 30),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_year_id, grade, class_no)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id),
  student_no smallint not null check (student_no between 1 and 100),
  name text not null check (char_length(name) between 1 and 50),
  nickname text,
  access_code_hash text not null,
  session_version integer not null default 1,
  active boolean not null default true,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, student_no)
);

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  school_id text not null references public.schools(id),
  login_id text not null,
  display_name text not null,
  role text not null check (role in ('owner','teacher')),
  access_code_hash text not null,
  session_version integer not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, login_id)
);

create table if not exists public.staff_class_scopes (
  staff_id uuid not null references public.staff(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  primary key (staff_id, class_id)
);

create table if not exists public.courses (
  id text primary key,
  title text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.units (
  id text primary key,
  course_id text not null references public.courses(id),
  title text not null,
  sort_order integer not null default 0,
  content_version integer not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.games (
  id text primary key,
  unit_id text not null references public.units(id),
  mode text not null,
  title text not null,
  settings jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, mode)
);

create table if not exists public.student_progress (
  student_id uuid not null references public.students(id) on delete cascade,
  unit_id text not null references public.units(id),
  progress jsonb not null default '{}'::jsonb,
  total_xp integer not null default 0 check (total_xp >= 0),
  level integer not null default 1 check (level >= 1),
  updated_at timestamptz not null default now(),
  primary key (student_id, unit_id)
);

create table if not exists public.game_attempts (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  student_id uuid not null references public.students(id),
  game_id text not null references public.games(id),
  content_version integer not null,
  status text not null check (status in ('started','completed','abandoned','rejected')),
  elapsed_ms integer check (elapsed_ms is null or elapsed_ms >= 0),
  answer_summary jsonb not null default '{}'::jsonb,
  score numeric,
  error_count integer not null default 0 check (error_count >= 0),
  hint_count integer not null default 0 check (hint_count >= 0),
  official boolean not null default false,
  reject_reason text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.reward_ledger (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  student_id uuid not null references public.students(id),
  unit_id text not null references public.units(id),
  attempt_id uuid references public.game_attempts(id),
  reward_type text not null check (reward_type in ('xp','pack','card','shard','mission','attendance','admin')),
  reward_key text not null,
  amount integer not null check (amount <> 0),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.pack_inventory (
  student_id uuid not null references public.students(id) on delete cascade,
  unit_id text not null references public.units(id),
  pack_id text not null,
  quantity integer not null default 0 check (quantity >= 0),
  pity_state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (student_id, unit_id, pack_id)
);

create table if not exists public.card_catalog (
  id text primary key,
  unit_id text not null references public.units(id),
  event_id text not null,
  title text not null,
  rarity text not null check (rarity in ('normal','rare','unique','legend','myth')),
  image_path text,
  active boolean not null default true,
  unique (unit_id, event_id, rarity)
);

create table if not exists public.student_cards (
  student_id uuid not null references public.students(id) on delete cascade,
  card_id text not null references public.card_catalog(id),
  effect text not null default 'normal',
  quantity integer not null default 0 check (quantity >= 0),
  locked boolean not null default false,
  first_acquired_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (student_id, card_id, effect)
);

create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  school_year_id uuid not null references public.school_years(id),
  unit_id text not null references public.units(id),
  mission_key text not null,
  title text not null,
  definition jsonb not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_year_id, unit_id, mission_key, starts_at)
);

create table if not exists public.mission_progress (
  mission_id uuid not null references public.missions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  progress integer not null default 0 check (progress >= 0),
  claimed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (mission_id, student_id)
);

create table if not exists public.app_sessions (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null check (actor_type in ('student','staff')),
  actor_id uuid not null,
  token_hash text not null unique,
  session_version integer not null,
  device_name text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.security_events (
  id bigint generated always as identity primary key,
  actor_type text,
  actor_id uuid,
  action text not null,
  code text not null,
  request_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists students_class_idx on public.students(class_id, active);
create index if not exists attempts_student_created_idx on public.game_attempts(student_id, created_at desc);
create index if not exists attempts_game_official_idx on public.game_attempts(game_id, official, elapsed_ms) where status = 'completed';
create index if not exists rewards_student_created_idx on public.reward_ledger(student_id, created_at desc);
create index if not exists sessions_actor_idx on public.app_sessions(actor_type, actor_id, expires_at desc);
create index if not exists sessions_active_idx on public.app_sessions(token_hash) where revoked_at is null;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'schools','school_years','classes','students','staff','staff_class_scopes',
    'courses','units','games','student_progress','game_attempts','reward_ledger',
    'pack_inventory','card_catalog','student_cards','missions','mission_progress',
    'app_sessions','security_events'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

drop trigger if exists schools_updated_at on public.schools;
create trigger schools_updated_at before update on public.schools for each row execute function public.set_updated_at();
drop trigger if exists school_years_updated_at on public.school_years;
create trigger school_years_updated_at before update on public.school_years for each row execute function public.set_updated_at();
drop trigger if exists classes_updated_at on public.classes;
create trigger classes_updated_at before update on public.classes for each row execute function public.set_updated_at();
drop trigger if exists students_updated_at on public.students;
create trigger students_updated_at before update on public.students for each row execute function public.set_updated_at();
drop trigger if exists staff_updated_at on public.staff;
create trigger staff_updated_at before update on public.staff for each row execute function public.set_updated_at();
drop trigger if exists courses_updated_at on public.courses;
create trigger courses_updated_at before update on public.courses for each row execute function public.set_updated_at();
drop trigger if exists units_updated_at on public.units;
create trigger units_updated_at before update on public.units for each row execute function public.set_updated_at();
drop trigger if exists games_updated_at on public.games;
create trigger games_updated_at before update on public.games for each row execute function public.set_updated_at();
drop trigger if exists student_progress_updated_at on public.student_progress;
create trigger student_progress_updated_at before update on public.student_progress for each row execute function public.set_updated_at();
drop trigger if exists pack_inventory_updated_at on public.pack_inventory;
create trigger pack_inventory_updated_at before update on public.pack_inventory for each row execute function public.set_updated_at();
drop trigger if exists student_cards_updated_at on public.student_cards;
create trigger student_cards_updated_at before update on public.student_cards for each row execute function public.set_updated_at();
drop trigger if exists missions_updated_at on public.missions;
create trigger missions_updated_at before update on public.missions for each row execute function public.set_updated_at();
drop trigger if exists mission_progress_updated_at on public.mission_progress;
create trigger mission_progress_updated_at before update on public.mission_progress for each row execute function public.set_updated_at();

insert into public.schools (id, name)
values ('dongju-middle', '동주중학교')
on conflict (id) do update set name = excluded.name;

insert into public.school_years (school_id, year)
values ('dongju-middle', 2026)
on conflict (school_id, year) do nothing;

insert into public.courses (id, title, sort_order)
values ('history-1', '역사 ①', 1)
on conflict (id) do update set title = excluded.title;

insert into public.units (id, course_id, title, sort_order)
values ('fr-revolution', 'history-1', '프랑스 혁명', 1)
on conflict (id) do update set title = excluded.title;

insert into public.games (id, unit_id, mode, title, sort_order)
values
  ('fr-connections', 'fr-revolution', 'connections', '혁명의 연결고리', 1),
  ('fr-beginner', 'fr-revolution', 'beginner', '초급', 2),
  ('fr-intermediate', 'fr-revolution', 'intermediate', '중급', 3),
  ('fr-advanced', 'fr-revolution', 'advanced', '고급', 4),
  ('fr-speedrun', 'fr-revolution', 'speedrun', '스피드런', 5),
  ('fr-baitrun', 'fr-revolution', 'baitrun', '미끼런', 6),
  ('fr-matching', 'fr-revolution', 'matching', '짝맞추기', 7),
  ('fr-revolutionmap', 'fr-revolution', 'revolutionmap', '사라진 혁명 지도', 8)
on conflict (id) do update set title = excluded.title, sort_order = excluded.sort_order;

select
  (select count(*) from public.schools) as schools,
  (select count(*) from public.units) as units,
  (select count(*) from public.games) as games;
