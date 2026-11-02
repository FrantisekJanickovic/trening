-- Tréning: univerzálny základ pre školské predmety (prvý je dejepis).
-- Tabuľky tr_* žijú v tom istom projekte ako appky Angličtina a Vybrané slová,
-- takže rodina má jeden účet, jeden PIN a tie isté profily detí.

-- Katalóg predmetov, spoločný a len na čítanie.
create table public.tr_subjects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z]{3,20}$'),
  name text not null,
  icon text not null default '📘',
  position int not null default 0
);
alter table public.tr_subjects enable row level security;
create policy "read_all" on public.tr_subjects for select to authenticated using (true);

insert into public.tr_subjects (slug, name, icon, position) values
  ('dejepis', 'Dejepis', '🏰', 1),
  ('geografia', 'Geografia', '🗺️', 2),
  ('chemia', 'Chémia', '⚗️', 3),
  ('biologia', 'Biológia', '🌿', 4);

-- Nastavenia predmetu pre rodinu (vrátane toho, či je predmet zapnutý).
create table public.tr_settings (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject text not null references public.tr_subjects(slug) on delete cascade,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (owner_id, subject)
);

-- Lekcia patrí predmetu a triede.
create table public.tr_lessons (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject text not null references public.tr_subjects(slug) on delete cascade,
  grade int check (grade between 1 and 9),
  title text not null check (char_length(title) between 1 and 160),
  position bigint not null default ((extract(epoch from now()) * 1000)::bigint),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.tr_lessons(owner_id, subject, grade, position);

-- Prepis nahratého materiálu, rozdelený na časti.
create table public.tr_sources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.tr_lessons(id) on delete cascade,
  page int not null default 1,
  heading text,
  text text not null check (char_length(text) between 1 and 20000),
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.tr_sources(lesson_id, position);

-- Jedno cvičenie. Obsah závisí od typu a je uložený ako json.
create table public.tr_exercises (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.tr_lessons(id) on delete cascade,
  type text not null check (type in ('mcq','truefalse','pairs','cloze','order')),
  payload jsonb not null,
  concept text not null default '',
  level int not null default 1 check (level between 1 and 3),
  source_id uuid references public.tr_sources(id) on delete set null,
  enabled boolean not null default true,
  position bigint not null default ((extract(epoch from now()) * 1000)::bigint),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.tr_exercises(lesson_id, enabled);

-- Odtrénované tréningy.
create table public.tr_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  subject text not null references public.tr_subjects(slug) on delete cascade,
  lesson_ids uuid[] not null default '{}',
  mode text not null default 'normal' check (mode in ('normal','focus')),
  planned int not null default 0,
  correct int not null default 0,
  score int not null default 0 check (score between 0 and 100),
  duration_sec int not null default 0,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.tr_sessions(child_id, created_at desc);

-- Čo dieťaťu nešlo a ako blízko je k zvládnutiu.
create table public.tr_progress (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  exercise_id uuid not null references public.tr_exercises(id) on delete cascade,
  wrong_count int not null default 0,
  sessions_count int not null default 0,
  correct_streak int not null default 0,
  mastered boolean not null default false,
  mastered_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_wrong_at timestamptz,
  last_session_id uuid references public.tr_sessions(id) on delete set null,
  constraint tr_progress_unique unique (child_id, exercise_id)
);
create index on public.tr_progress(child_id, mastered);

-- Správy pre rodiča: zatiaľ v appke, neskôr aj e-mailom alebo pushom.
create table public.tr_notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  child_id uuid references public.children(id) on delete set null,
  subject text not null references public.tr_subjects(slug) on delete cascade,
  session_id uuid references public.tr_sessions(id) on delete cascade,
  kind text not null check (kind in ('session_done','low_score')),
  title text not null,
  body text not null default '',
  score int check (score between 0 and 100),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.tr_notifications(owner_id, read_at, created_at desc);

do $$
declare t text;
begin
  foreach t in array array['tr_settings','tr_lessons','tr_sources','tr_exercises','tr_sessions','tr_progress','tr_notifications'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "owner_select" on public.%I for select to authenticated using (owner_id = (select auth.uid()))', t);
    execute format('create policy "owner_insert" on public.%I for insert to authenticated with check (owner_id = (select auth.uid()))', t);
    execute format('create policy "owner_update" on public.%I for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', t);
    execute format('create policy "owner_delete" on public.%I for delete to authenticated using (owner_id = (select auth.uid()))', t);
  end loop;
end $$;
