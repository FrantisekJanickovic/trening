import type { GlobalConfig, GrammarItem, ItemType, Lesson, ProblemItem, VocabItem } from "./types";

/** What the app knows about a question when it saves it as a problem. */
export type CatalogEntry = { type: ItemType; id: string; lesson_id: string; label: string; detail: string | null };

/** How one question went during one training. */
export type ItemTally = { type: ItemType; id: string; wrong: number; solid: number; lastWrong: string | null };

export const itemKey = (type: string, id: string) => `${type}:${id}`;

export const vocabEntry = (v: VocabItem): CatalogEntry => ({
  type: "vocab",
  id: v.id,
  lesson_id: v.lesson_id,
  label: `${v.en} – ${v.sk}`,
  detail: v.example_en,
});

export const grammarEntry = (g: GrammarItem): CatalogEntry => ({
  type: "grammar",
  id: g.id,
  lesson_id: g.lesson_id,
  label: g.prompt,
  detail: `správne: ${g.answer.split("|")[0].trim()}`,
});

export const sentenceEntry = (s: { id: string; en: string; sk: string; lesson_id: string }): CatalogEntry => ({
  type: "sentence",
  id: s.id,
  lesson_id: s.lesson_id,
  label: s.en,
  detail: s.sk || null,
});

export const PROBLEM_TYPE_LABEL: Record<ProblemItem["item_type"], string> = {
  vocab: "Slovíčko",
  grammar: "Gramatika",
  sentence: "Veta",
  pronunciation: "Výslovnosť",
};

type Row = Omit<ProblemItem, "id" | "first_seen_at">;

/**
 * Turn one training into problem-item rows to upsert:
 * - questions answered wrong are saved (the worst `maxSavedPerSession` new ones) and their streak resets,
 * - known unmastered questions answered right without help move towards mastery and are marked mastered
 *   after `masteryStreak` such trainings.
 */
export function problemUpdates(opts: {
  tallies: ItemTally[];
  catalog: Map<string, CatalogEntry>;
  existing: Map<string, ProblemItem>;
  childId: string;
  sessionId: string;
  config: GlobalConfig;
  now: string;
}): Row[] {
  const { tallies, catalog, existing, childId, sessionId, config, now } = opts;
  const rows: Row[] = [];
  const base = (e: CatalogEntry, ex: ProblemItem | undefined): Row => ({
    child_id: childId,
    lesson_id: e.lesson_id,
    item_type: e.type,
    item_id: e.id,
    label: e.label,
    detail: e.detail,
    last_answer: ex?.last_answer ?? null,
    wrong_count: ex?.wrong_count ?? 0,
    sessions_count: ex?.sessions_count ?? 0,
    correct_streak: ex?.correct_streak ?? 0,
    mastered: ex?.mastered ?? false,
    mastered_at: ex?.mastered_at ?? null,
    last_wrong_at: ex?.last_wrong_at ?? null,
    last_session_id: ex?.last_session_id ?? null,
  });

  const wrong = tallies.filter((t) => t.wrong > 0).sort((a, b) => b.wrong - a.wrong);
  let fresh = 0;
  for (const t of wrong) {
    const k = itemKey(t.type, t.id);
    const e = catalog.get(k);
    if (!e) continue;
    const ex = existing.get(k);
    if (!ex) {
      if (fresh >= config.maxSavedPerSession) continue;
      fresh++;
    }
    rows.push({
      ...base(e, ex),
      last_answer: t.lastWrong ?? ex?.last_answer ?? null,
      wrong_count: (ex?.wrong_count ?? 0) + t.wrong,
      sessions_count: (ex?.sessions_count ?? 0) + 1,
      correct_streak: 0,
      mastered: false,
      mastered_at: null,
      last_wrong_at: now,
      last_session_id: sessionId,
    });
  }

  for (const t of tallies) {
    if (t.wrong > 0 || t.solid === 0) continue;
    const k = itemKey(t.type, t.id);
    const ex = existing.get(k);
    const e = catalog.get(k);
    if (!ex || ex.mastered || !e) continue;
    const streak = ex.correct_streak + 1;
    const mastered = streak >= config.masteryStreak;
    rows.push({ ...base(e, ex), correct_streak: streak, mastered, mastered_at: mastered ? now : null, last_session_id: sessionId });
  }
  return rows;
}

/** Lessons in the order the class goes through them. */
export function orderLessons<T extends Pick<Lesson, "grade" | "position" | "created_at">>(lessons: T[]): T[] {
  return [...lessons].sort((a, b) => (a.grade ?? 0) - (b.grade ?? 0) || (a.position ?? 0) - (b.position ?? 0) || a.created_at.localeCompare(b.created_at));
}

/** The `count` lessons right before the earliest selected one, not counting the selected lessons themselves. */
export function previousLessonIds<T extends Pick<Lesson, "id" | "grade" | "position" | "created_at">>(
  lessons: T[],
  selected: string[],
  count: number,
): string[] {
  const ordered = orderLessons(lessons);
  const first = ordered.findIndex((l) => selected.includes(l.id));
  if (first <= 0 || count <= 0) return [];
  const chosen = new Set(selected);
  return ordered
    .slice(0, first)
    .filter((l) => !chosen.has(l.id))
    .slice(-count)
    .map((l) => l.id);
}

/** Pick up to `max` unmastered problems, drawing at random from the ones with the most mistakes. */
export function pickReview(problems: ProblemItem[], max: number): ProblemItem[] {
  const open = problems.filter((p) => !p.mastered).sort((a, b) => b.wrong_count - a.wrong_count);
  const pool = open.slice(0, Math.max(max * 2, max));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, max);
}
