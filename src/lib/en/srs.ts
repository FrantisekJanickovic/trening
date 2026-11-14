import type { ItemProgress } from "./types";

/** Leitner boxes: days until the item is due again. */
const INTERVAL_DAYS = [0, 0, 1, 3, 7, 14];

export type Outcome = "correct" | "hinted" | "wrong";

export function nextProgress(prev: ItemProgress | undefined, base: Pick<ItemProgress, "child_id" | "item_type" | "item_id">, outcome: Outcome): ItemProgress {
  const box = prev?.box ?? 1;
  const nextBox = outcome === "correct" ? Math.min(5, box + 1) : outcome === "hinted" ? box : 1;
  const due = new Date();
  due.setDate(due.getDate() + INTERVAL_DAYS[nextBox]);
  if (nextBox === 1) due.setMinutes(due.getMinutes() + 10);
  return {
    ...base,
    box: nextBox,
    due_at: due.toISOString(),
    correct_count: (prev?.correct_count ?? 0) + (outcome === "wrong" ? 0 : 1),
    wrong_count: (prev?.wrong_count ?? 0) + (outcome === "wrong" ? 1 : 0),
    last_seen: new Date().toISOString(),
  };
}

/** Lower score = practise sooner. New items sit between due problem words and well-known ones. */
export function priority(p: ItemProgress | undefined, now = Date.now()): number {
  if (!p) return 50;
  const due = new Date(p.due_at).getTime() <= now;
  return (due ? 0 : 100) + p.box * 10 - Math.min(p.wrong_count, 9);
}

export function isProblem(p: ItemProgress | undefined) {
  return !!p && p.box <= 2 && p.wrong_count > 0;
}
