import type { Exercise, Progress, SubjectConfig } from "./types";

/** Ako dopadlo jedno cvičenie v jednom tréningu. */
export type Tally = { exerciseId: string; wrong: number; solid: number };

type Row = Omit<Progress, "id" | "first_seen_at">;

/**
 * Z jedného tréningu spraví riadky na uloženie. Chybné cvičenia sa zapamätajú a séria sa vynuluje.
 * Pri správnej odpovedi sa cvičenie, ktoré predtým nešlo, posúva k zvládnutiu; pri ostatných sa
 * uloží len to, že ich dieťa videlo, aby sa v ďalších tréningoch striedali.
 */
export function progressUpdates(opts: {
  tallies: Tally[];
  existing: Map<string, Progress>;
  childId: string;
  sessionId: string;
  config: SubjectConfig;
  now: string;
}): Row[] {
  const { tallies, existing, childId, sessionId, config, now } = opts;
  const rows: Row[] = [];
  for (const t of tallies) {
    const ex = existing.get(t.exerciseId);
    const base: Row = {
      child_id: childId,
      exercise_id: t.exerciseId,
      wrong_count: ex?.wrong_count ?? 0,
      sessions_count: ex?.sessions_count ?? 0,
      correct_streak: ex?.correct_streak ?? 0,
      mastered: ex?.mastered ?? false,
      mastered_at: ex?.mastered_at ?? null,
      last_wrong_at: ex?.last_wrong_at ?? null,
      last_session_id: ex?.last_session_id ?? null,
    };
    if (t.wrong > 0) {
      rows.push({
        ...base,
        wrong_count: base.wrong_count + t.wrong,
        sessions_count: base.sessions_count + 1,
        correct_streak: 0,
        mastered: false,
        mastered_at: null,
        last_wrong_at: now,
        last_session_id: sessionId,
      });
    } else if (t.solid > 0) {
      // správna odpoveď: cvičenie, ktoré predtým nešlo, sa posúva k zvládnutiu;
      // u ostatných si len zapamätáme, že ich dieťa už videlo, nech prídu na rad aj ďalšie
      const streak = base.correct_streak + 1;
      const mastered = !ex?.mastered && base.wrong_count > 0 && streak >= config.masteryStreak;
      rows.push({
        ...base,
        sessions_count: base.sessions_count + 1,
        correct_streak: streak,
        mastered: ex?.mastered || mastered,
        mastered_at: mastered ? now : base.mastered_at,
        last_session_id: sessionId,
      });
    }
  }
  return rows;
}

/** Cvičenia, ktoré dieťaťu nešli a ešte ich nezvládlo. */
export const openProblems = (exercises: Exercise[], progress: Progress[]) => {
  const open = new Set(progress.filter((p) => !p.mastered && p.wrong_count > 0).map((p) => p.exercise_id));
  return exercises.filter((e) => open.has(e.id));
};
