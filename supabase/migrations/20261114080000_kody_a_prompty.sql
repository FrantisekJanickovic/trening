-- Krátky kód cvičenia, unikátny cez celú tabuľku. Rodič ho vidí v hlavičke
-- cvičenia a môže sa naň odvolať v prompte pre AI ("sprav podobné ako A3F7K2").
alter table public.tr_exercises add column if not exists code text;

create or replace function public.tr_exercise_code() returns text
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
    exit when not exists (select 1 from public.tr_exercises where code = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function public.tr_exercises_set_code() returns trigger
language plpgsql
as $$
begin
  if new.code is null or new.code = '' then
    new.code := public.tr_exercise_code();
  end if;
  return new;
end;
$$;

drop trigger if exists tr_exercises_code on public.tr_exercises;
create trigger tr_exercises_code before insert on public.tr_exercises
for each row execute function public.tr_exercises_set_code();

-- staré cvičenia doplníme po jednom, nech si kódy v jednom príkaze nekolidujú
do $$
declare r record;
begin
  for r in select id from public.tr_exercises where code is null or code = '' loop
    update public.tr_exercises set code = public.tr_exercise_code() where id = r.id;
  end loop;
end;
$$;

alter table public.tr_exercises alter column code set not null;
create unique index if not exists tr_exercises_code_key on public.tr_exercises(code);
