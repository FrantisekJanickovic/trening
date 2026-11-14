-- Angličtina sa sťahuje pod Tréning ako ďalší predmet. Vlastné tabuľky
-- (lessons, vocab_items, grammar_items, lesson_texts, item_progress,
-- problem_items, attempts, sessions, parent_settings) zostávajú ako sú,
-- mení sa len to, že predmet je vidno na rozcestníku.
--
-- POZOR: tento riadok pridávaj až po nasadení kódu, inak dlaždica vedie
-- na stránku, ktorá v produkcii ešte neexistuje.
insert into public.tr_subjects (slug, name, icon, position)
values ('anglictina', 'Angličtina', '🇬🇧', 0)
on conflict (slug) do nothing;
