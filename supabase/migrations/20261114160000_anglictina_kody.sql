-- Krátky kód položky angličtiny, unikátny cez slovíčka, gramatiku aj texty
-- naraz, nech jeden kód nikdy neznamená dve veci. Rodič sa naň odvoláva
-- v prompte pre AI ("sprav podobné ako A3F7K2").
alter table public.vocab_items add column if not exists code text;
alter table public.grammar_items add column if not exists code text;
alter table public.lesson_texts add column if not exists code text;

create or replace function public.en_item_code() returns text
language plpgsql
as $$
declare
  -- bez znakov, ktoré sa dajú zameniť (0/O, 1/I)
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  candidate text;
  i int;
begin
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.vocab_items where code = candidate)
         and not exists (select 1 from public.grammar_items where code = candidate)
         and not exists (select 1 from public.lesson_texts where code = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function public.en_set_code() returns trigger
language plpgsql
as $$
begin
  if new.code is null or new.code = '' then
    new.code := public.en_item_code();
  end if;
  return new;
end;
$$;

drop trigger if exists vocab_items_code on public.vocab_items;
create trigger vocab_items_code before insert on public.vocab_items
for each row execute function public.en_set_code();

drop trigger if exists grammar_items_code on public.grammar_items;
create trigger grammar_items_code before insert on public.grammar_items
for each row execute function public.en_set_code();

drop trigger if exists lesson_texts_code on public.lesson_texts;
create trigger lesson_texts_code before insert on public.lesson_texts
for each row execute function public.en_set_code();

-- staré položky doplníme po jednom, nech si kódy navzájom nekolidujú
do $$
declare r record;
begin
  for r in select id from public.vocab_items where code is null or code = '' loop
    update public.vocab_items set code = public.en_item_code() where id = r.id;
  end loop;
  for r in select id from public.grammar_items where code is null or code = '' loop
    update public.grammar_items set code = public.en_item_code() where id = r.id;
  end loop;
  for r in select id from public.lesson_texts where code is null or code = '' loop
    update public.lesson_texts set code = public.en_item_code() where id = r.id;
  end loop;
end;
$$;

create unique index if not exists vocab_items_code_key on public.vocab_items(code);
create unique index if not exists grammar_items_code_key on public.grammar_items(code);
create unique index if not exists lesson_texts_code_key on public.lesson_texts(code);
