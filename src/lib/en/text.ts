/** Answer checking helpers. */

export function stripDiacritics(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[.,!?;:"„“”]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "pes, psík / havko" → ["pes", "psík", "havko"]; keeps the first as the display answer. */
export function alternatives(answer: string): string[] {
  return answer
    .split(/[,;/|]/)
    .map((a) => a.trim())
    .filter(Boolean);
}

export function displayAnswer(answer: string) {
  return alternatives(answer)[0] ?? answer;
}

export function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

export type CheckResult = { ok: boolean; close: boolean; matched: string };

/**
 * Written answers: exact after normalisation; Slovak target ignores missing diacritics.
 * Oral answers: allow small recognition noise.
 */
export function checkAnswer(given: string, expected: string, opts: { target: "en" | "sk"; oral?: boolean }): CheckResult {
  const g = normalize(given);
  const alts = alternatives(expected);
  let best = { dist: Infinity, alt: alts[0] ?? expected };
  for (const alt of alts) {
    const e = normalize(alt);
    let a = g;
    let b = e;
    if (opts.target === "sk" || opts.oral) {
      a = stripDiacritics(a);
      b = stripDiacritics(b);
    }
    // ignore leading article "a/an/the" and "to " for verbs
    const trim = (x: string) => x.replace(/^(a|an|the|to) /, "");
    const d = Math.min(levenshtein(a, b), levenshtein(trim(a), trim(b)));
    if (d < best.dist) best = { dist: d, alt };
  }
  const len = normalize(best.alt).length;
  const tolerance = opts.oral ? (len >= 7 ? 2 : len >= 4 ? 1 : 0) : 0;
  return { ok: best.dist <= tolerance, close: best.dist <= (len >= 5 ? 2 : 1), matched: best.alt };
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function letterSlots(word: string) {
  return Array.from(word);
}

/** Current time in ms (kept in a helper so timing code stays out of render analysis). */
export const nowMs = () => Date.now();
