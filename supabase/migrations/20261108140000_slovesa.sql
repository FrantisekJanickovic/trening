-- Nepravidelné slovesá: jeden očíslovaný zoznam pre celú rodinu.
-- Žiak si pri štarte zvolí rozsah (napríklad 1 až 12), takže záleží na poradí,
-- nie na tom, ku ktorej nafotenej strane sloveso patrí.

create table public.tr_verbs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- triedi zoznam; číslo, ktoré vidí dieťa, je poradie v zozname, nie táto hodnota
  num int not null check (num >= 1),
  base text not null check (char_length(base) between 1 and 80),
  past text not null default '',
  participle text not null default '',
  sk text not null default '',
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.tr_verbs(owner_id, num);

alter table public.tr_verbs enable row level security;
create policy "owner_select" on public.tr_verbs for select to authenticated using (owner_id = (select auth.uid()));
create policy "owner_insert" on public.tr_verbs for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "owner_update" on public.tr_verbs for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "owner_delete" on public.tr_verbs for delete to authenticated using (owner_id = (select auth.uid()));

insert into public.tr_subjects (slug, name, icon, position)
values ('slovesa', 'Nepravidelné slovesá', '🔤', 6)
on conflict (slug) do nothing;
