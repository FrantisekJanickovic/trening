-- Sady v angličtine: rodič vyberie konkrétne slovíčka, gramatiku či texty
-- a dieťa ich dostane ako samostatný dril. Plus vypínač jednotlivej položky,
-- nech sa nepodarená nemusí mazať.
alter table public.vocab_items add column if not exists enabled boolean not null default true;
alter table public.grammar_items add column if not exists enabled boolean not null default true;
alter table public.lesson_texts add column if not exists enabled boolean not null default true;

create table if not exists public.en_sets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  -- položky ako [{"kind":"vocab","id":"…"}, …]; miešať sa smú všetky tri druhy
  items jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists en_sets_lesson_idx on public.en_sets(lesson_id);

alter table public.en_sets enable row level security;
create policy "owner_select" on public.en_sets for select to authenticated using (owner_id = (select auth.uid()));
create policy "owner_insert" on public.en_sets for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "owner_update" on public.en_sets for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "owner_delete" on public.en_sets for delete to authenticated using (owner_id = (select auth.uid()));
