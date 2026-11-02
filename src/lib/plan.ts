import type { Exercise, Progress } from "./types";

export const COUNTS = [10, 15, 20, 25, 30, 40, 50];

type Rand = () => number;

export function shuffle<T>(a: T[], rand: Rand = Math.random): T[] {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Poradie, v ktorom sa nestriedajú len dva typy a rovnaká téma nejde hneď za sebou. */
export function arrange(items: Exercise[], rand: Rand = Math.random): Exercise[] {
  const pool = shuffle(items, rand);
  const out: Exercise[] = [];
  while (pool.length) {
    const prev = out[out.length - 1];
    const prev2 = out[out.length - 2];
    let i = pool.findIndex((e) => (!prev || e.type !== prev.type) && (!prev || !e.concept || e.concept !== prev.concept));
    if (i < 0) i = pool.findIndex((e) => !prev || !prev2 || e.type !== prev.type || prev.type !== prev2.type);
    if (i < 0) i = 0;
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

/**
 * Tréning: najprv cvičenia, ktoré dieťaťu nešli, potom tie, ktoré ešte nevidelo,
 * nakoniec zvládnuté na zopakovanie. V režime „len chyby“ sa berú iba nezvládnuté chyby.
 */
export function buildPlan(opts: { exercises: Exercise[]; progress: Progress[]; count: number; focus?: boolean; rand?: Rand }): Exercise[] {
  const { exercises, progress, count, focus } = opts;
  const rand = opts.rand ?? Math.random;
  const byId = new Map(progress.map((p) => [p.exercise_id, p]));
  const usable = exercises.filter((e) => e.enabled);

  const wrong = usable.filter((e) => {
    const p = byId.get(e.id);
    return p && !p.mastered && p.wrong_count > 0;
  });
  if (focus) return arrange(shuffle(wrong, rand).slice(0, count), rand);

  const fresh = usable.filter((e) => !byId.has(e.id));
  const rest = usable.filter((e) => byId.has(e.id) && !wrong.includes(e));
  const picked = [...shuffle(wrong, rand), ...shuffle(fresh, rand), ...shuffle(rest, rand)].slice(0, count);
  return arrange(picked, rand);
}
