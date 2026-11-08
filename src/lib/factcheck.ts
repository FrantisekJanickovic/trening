"use client";

import type { SubjectSlug } from "@/data/subjects";
import { factcheck } from "./ai";
import { explainOf, preview, solution, typeLabel } from "./exercises";
import { supabase } from "./supabase";
import type { Exercise, Lesson, Source } from "./types";

/** Cvičenie v podobe, v akej ho dostane kontrolný model — aj so správnou odpoveďou. */
export const describeExercise = (e: Exercise) => {
  const ex = explainOf(e.type, e.payload);
  return [`Typ: ${typeLabel(e.type)}`, preview(e.type, e.payload), `Správna odpoveď: ${solution(e.type, e.payload)}`, ex ? `Vysvetlenie: ${ex}` : ""]
    .filter(Boolean)
    .join("\n");
};

export type CheckResult = { checked: number; problems: number; skipped: number };

/**
 * Dá cvičenia skontrolovať AI a výsledok zapíše.
 * Čo prejde, dostane príznak skontrolované; čo neprejde, ostáva neoznačené
 * aj s poznámkou, prečo — tak sa to dá neskôr dokontrolovať jedným tlačidlom.
 * Kontroluje sa po dávkach, aby dlhá lekcia nespadla na jednom veľkom volaní.
 */
export async function runFactcheck(input: {
  slug: SubjectSlug;
  lesson: Lesson;
  sources: Source[];
  exercises: Exercise[];
  batchSize?: number;
}): Promise<CheckResult> {
  const { slug, lesson, sources, exercises } = input;
  const batchSize = input.batchSize ?? 12;
  if (!exercises.length) return { checked: 0, problems: 0, skipped: 0 };
  if (!sources.length) throw new Error("Lekcia nemá prepísaný materiál, nie je s čím porovnávať.");

  const sections = sources.map((s) => ({ heading: s.heading ?? "", text: s.text }));
  const sb = supabase();
  let checked = 0;
  let problems = 0;
  let skipped = 0;

  for (let i = 0; i < exercises.length; i += batchSize) {
    const batch = exercises.slice(i, i + batchSize);
    const r = await factcheck({
      subject: slug,
      grade: lesson.grade,
      title: lesson.title,
      sections,
      items: batch.map((e) => ({ id: e.id, text: describeExercise(e) })),
    });

    const good = r.results.filter((x) => x.ok).map((x) => x.id);
    const bad = r.results.filter((x) => !x.ok);
    if (good.length) {
      const { error } = await sb.from("tr_exercises").update({ checked: true, check_note: null }).in("id", good);
      if (error) throw new Error(error.message);
      checked += good.length;
    }
    for (const b of bad) {
      const { error } = await sb.from("tr_exercises").update({ checked: false, check_note: b.note }).eq("id", b.id);
      if (error) throw new Error(error.message);
      problems++;
    }
    skipped += r.missing.length;
  }
  return { checked, problems, skipped };
}
