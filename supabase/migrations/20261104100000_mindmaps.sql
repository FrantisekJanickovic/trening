-- Myšlienkové mapy k lekcii.
-- Rodič ich generuje z vybraných strán (alebo z celej kapitoly) a tie, ktoré označí
-- ako aktívne, uvidí dieťa vo svojom prístupe a môže si ich stiahnuť na tlač.

create table public.tr_mindmaps (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.tr_lessons(id) on delete cascade,
  -- prázdne pole znamená celú kapitolu; inak čísla strán, z ktorých mapa vznikla
  pages int[] not null default '{}',
  prompt text not null default '',
  title text not null check (char_length(title) between 1 and 200),
  data jsonb not null,
  active boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.tr_mindmaps(lesson_id, created_at desc);
create index on public.tr_mindmaps(owner_id, active);

alter table public.tr_mindmaps enable row level security;
create policy "owner_select" on public.tr_mindmaps for select to authenticated using (owner_id = (select auth.uid()));
create policy "owner_insert" on public.tr_mindmaps for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "owner_update" on public.tr_mindmaps for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "owner_delete" on public.tr_mindmaps for delete to authenticated using (owner_id = (select auth.uid()));
