-- Kontrola cvičení, aspekty učiva, sady, časové osi a galéria obrázkov.

-- 1) Cvičenie vie, či ho AI skontrolovala a o akú časť učiva ide.
alter table public.tr_exercises
  add column checked boolean not null default false,
  add column check_note text,
  -- roky = letopočty a dátumy, cisla = ostatné čísla (rozloha, počty),
  -- mena = osobnosti, miesta = zemepisné názvy, pojmy = odborné výrazy,
  -- suvislosti = príčiny, následky a procesy
  add column aspect text not null default 'pojmy'
    check (aspect in ('roky', 'cisla', 'mena', 'miesta', 'pojmy', 'suvislosti'));
create index on public.tr_exercises(lesson_id, checked);

-- 2) Myšlienkové mapy a časové osi zdieľajú tabuľku; líšia sa druhom.
alter table public.tr_mindmaps
  add column kind text not null default 'mindmap' check (kind in ('mindmap', 'timeline'));

-- 3) Sada = pomenovaný výber konkrétnych cvičení, ktorý žiak spustí ako podtréning.
create table public.tr_sets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.tr_lessons(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  exercise_ids uuid[] not null default '{}',
  active boolean not null default true,
  position bigint not null default 0,
  created_at timestamptz not null default now()
);
create index on public.tr_sets(lesson_id, position);

-- 4) Obrázok vyrezaný z nafotenej strany, s popisom z knihy a dovysvetlením.
create table public.tr_figures (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.tr_lessons(id) on delete cascade,
  source_id uuid references public.tr_sources(id) on delete set null,
  page int not null default 1,
  -- cesta v úložisku: <owner_id>/<lesson_id>/<nazov>.jpg
  path text not null,
  caption text not null default '',
  explain text not null default '',
  position bigint not null default 0,
  created_at timestamptz not null default now()
);
create index on public.tr_figures(lesson_id, position);

alter table public.tr_sets enable row level security;
alter table public.tr_figures enable row level security;

do $$
declare t text;
begin
  foreach t in array array['tr_sets', 'tr_figures'] loop
    execute format('create policy "owner_select" on public.%I for select to authenticated using (owner_id = (select auth.uid()))', t);
    execute format('create policy "owner_insert" on public.%I for insert to authenticated with check (owner_id = (select auth.uid()))', t);
    execute format('create policy "owner_update" on public.%I for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', t);
    execute format('create policy "owner_delete" on public.%I for delete to authenticated using (owner_id = (select auth.uid()))', t);
  end loop;
end $$;

-- 5) Úložisko obrázkov. Súkromné, každý vidí len svoj priečinok podľa owner_id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lekcie', 'lekcie', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "lekcie_select" on storage.objects for select to authenticated
  using (bucket_id = 'lekcie' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "lekcie_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'lekcie' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "lekcie_update" on storage.objects for update to authenticated
  using (bucket_id = 'lekcie' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "lekcie_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'lekcie' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 6) Nový predmet.
insert into public.tr_subjects (slug, name, icon, position)
values ('vlastiveda', 'Vlastiveda', '🧭', 5)
on conflict (slug) do nothing;
