/**
 * Výber strán v rámci lekcie.
 *
 * Žiak si môže zobrať celú kapitolu alebo len niektoré strany — napríklad keď je
 * skúška len z polovice lekcie. Výber sa nesie v adrese, aby bol tréning
 * obnoviteľný a zdieľateľný: pre každú lekciu jedna skupina, `*` znamená všetky
 * strany, inak sú to čísla strán oddelené bodkou. Skupiny oddeľuje `|` a idú
 * v rovnakom poradí ako lekcie.
 *
 *   pages=*|3.4   →  prvá lekcia celá, z druhej len strany 3 a 4
 */
import type { Exercise, Source } from "./types";

/** Prázdne pole = celá kapitola. */
export type Selection = Record<string, number[]>;

export const pagesOf = (sources: Source[], lessonId: string) =>
  [...new Set(sources.filter((s) => s.lesson_id === lessonId).map((s) => s.page))].sort((a, b) => a - b);

export function encodePages(lessonIds: string[], sel: Selection, sources: Source[]): string {
  return lessonIds
    .map((id) => {
      const picked = sel[id] ?? [];
      const all = pagesOf(sources, id);
      return !picked.length || picked.length === all.length ? "*" : [...picked].sort((a, b) => a - b).join(".");
    })
    .join("|");
}

export function decodePages(param: string | null, lessonIds: string[]): Selection {
  const groups = (param ?? "").split("|");
  const out: Selection = {};
  lessonIds.forEach((id, i) => {
    const g = groups[i];
    out[id] = !g || g === "*" ? [] : g.split(".").map(Number).filter((n) => Number.isInteger(n) && n > 0);
  });
  return out;
}

/**
 * Nechá len cvičenia z vybraných strán.
 * Cvičenie bez priradenej strany (dopísané ručne) patrí celej kapitole, takže sa
 * počíta len vtedy, keď je vybratá celá kapitola — inak by sa dostalo do skúšania
 * z látky, ktorú dieťa práve nepreberá.
 */
export function filterByPages(exercises: Exercise[], sources: Source[], sel: Selection): Exercise[] {
  const pageOfSource = new Map(sources.map((s) => [s.id, s.page]));
  return exercises.filter((e) => {
    const picked = sel[e.lesson_id];
    if (!picked || !picked.length) return true; // celá kapitola
    const page = e.source_id ? pageOfSource.get(e.source_id) : undefined;
    return page !== undefined && picked.includes(page);
  });
}

/** „celá kapitola“ alebo „strany 3, 4“ — do popisov v appke aj do hlavičky tlače. */
export const describePages = (pages: number[], total: number) =>
  !pages.length || pages.length === total ? "celá kapitola" : pages.length === 1 ? `strana ${pages[0]}` : `strany ${[...pages].sort((a, b) => a - b).join(", ")}`;
