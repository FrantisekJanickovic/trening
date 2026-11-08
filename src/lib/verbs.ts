/**
 * Nepravidelné slovesá: čo sa z nich dá skúšať a ako sa vyhodnocuje odpoveď.
 *
 * Nestavia sa z nich cvičenia do databázy ako pri ostatných predmetoch —
 * otázky sa skladajú až pri štarte podľa toho, čo si dieťa navolí. Zoznam je
 * jeden a očíslovaný, takže „od 1 do 12“ znamená prvých dvanásť v poradí.
 */

export type Verb = {
  id: string;
  num: number;
  base: string;
  past: string;
  participle: string;
  sk: string;
  enabled: boolean;
  created_at: string;
};

/** Smer prekladu. „oboje“ strieda náhodne, zhruba pol na pol. */
export type Direction = "enu-sk" | "sk-enu" | "oboje";
export const DIRECTIONS: { value: Direction; label: string }[] = [
  { value: "enu-sk", label: "Anglicky → slovensky" },
  { value: "sk-enu", label: "Slovensky → anglicky" },
  { value: "oboje", label: "Oboje, náhodne" },
];

export type AnswerMode = "pisanie" | "vyber";
export const ANSWER_MODES: { value: AnswerMode; label: string; hint: string }[] = [
  { value: "vyber", label: "Výber z možností", hint: "ľahšie, dobré na začiatok" },
  { value: "pisanie", label: "Písanie", hint: "ťažšie, ale naučí aj pravopis" },
];

export type DrillKind = "preklad" | "tvary" | "oboje";
export const DRILLS: { value: DrillKind; label: string; hint: string }[] = [
  { value: "preklad", label: "Preklad", hint: "čo sloveso znamená" },
  { value: "tvary", label: "Tvary", hint: "minulý čas a príčastie" },
  { value: "oboje", label: "Preklad aj tvary", hint: "strieda sa to" },
];

export const OPTION_COUNTS = [3, 4, 5, 6];

export type VerbSetup = {
  from: number;
  to: number;
  direction: Direction;
  answer: AnswerMode;
  options: number;
  drill: DrillKind;
  count: number;
};

/* ------------------------------------------------------------- porovnávanie */

/** Diakritika, veľkosť písmen a zdvojené medzery sa pri kontrole neberú do úvahy. */
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("sk")
    .replace(/[.,;!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** „learned/learnt“ aj „ísť, chodiť“ sú viaceré platné odpovede. */
export const variants = (field: string) =>
  field
    .split(/[/,;]/)
    .map((x) => x.trim())
    .filter(Boolean);

/** Anglické tvary sa občas píšu s „to“; to dieťaťu nezrátame ako chybu. */
const strip = (s: string) => norm(s).replace(/^to\s+/, "");

export const answerMatches = (given: string, expected: string) => {
  const g = strip(given);
  return !!g && variants(expected).some((v) => strip(v) === g);
};

/* ----------------------------------------------------------------- otázky */

export type VerbTask =
  | { kind: "preklad"; verb: Verb; ask: string; from: "enu" | "sk"; expected: string }
  | { kind: "tvary"; verb: Verb; ask: string; from: "enu" | "sk"; fields: ("past" | "participle")[] };

export const FIELD_LABEL: Record<"past" | "participle", string> = {
  past: "Minulý čas (past simple)",
  participle: "Minulé príčastie (past participle)",
};

export function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** Sloveso sa dá skúšať na preklad len vtedy, keď má obe strany. */
export const canTranslate = (v: Verb) => !!v.base.trim() && !!v.sk.trim();
export const canForms = (v: Verb) => !!v.base.trim() && !!v.past.trim() && !!v.participle.trim();

export function buildTasks(verbs: Verb[], setup: VerbSetup): VerbTask[] {
  const usable = verbs.filter((v) => v.enabled && (setup.drill === "preklad" ? canTranslate(v) : setup.drill === "tvary" ? canForms(v) : canTranslate(v) || canForms(v)));
  if (!usable.length) return [];

  const out: VerbTask[] = [];
  let bag: Verb[] = [];
  // smer sa pri „oboje“ strieda pol na pol, nie čisto náhodne — inak môže
  // vyjsť celý tréning jedným smerom
  const dirs = shuffle(usable.map((_, i) => (i % 2 === 0 ? "enu" : "sk") as "enu" | "sk"));

  for (let i = 0; i < setup.count; i++) {
    if (!bag.length) bag = shuffle(usable);
    const verb = bag.pop()!;
    const from: "enu" | "sk" = setup.direction === "enu-sk" ? "enu" : setup.direction === "sk-enu" ? "sk" : dirs[i % dirs.length];

    const wantForms = setup.drill === "tvary" || (setup.drill === "oboje" && Math.random() < 0.5);
    if (wantForms && canForms(verb)) {
      out.push({
        kind: "tvary",
        verb,
        // pri tvaroch sa pýtame na anglické tvary; zadanie môže byť v oboch jazykoch
        ask: from === "sk" && verb.sk ? verb.sk : verb.base,
        from: from === "sk" && verb.sk ? "sk" : "enu",
        // poradie sa strieda, nech si dieťa nezafixuje postupnosť
        fields: shuffle(["past", "participle"]) as ("past" | "participle")[],
      });
      continue;
    }
    if (canTranslate(verb)) {
      out.push({
        kind: "preklad",
        verb,
        ask: from === "enu" ? verb.base : verb.sk,
        from,
        expected: from === "enu" ? verb.sk : verb.base,
      });
      continue;
    }
    if (canForms(verb)) {
      out.push({ kind: "tvary", verb, ask: verb.base, from: "enu", fields: shuffle(["past", "participle"]) as ("past" | "participle")[] });
    }
  }
  return out;
}

/** Možnosti na výber: správna odpoveď plus tvary iných slovies z rovnakého stĺpca. */
export function choicesFor(correct: string, pool: Verb[], field: "base" | "past" | "participle" | "sk", howMany: number): string[] {
  const want = Math.max(2, Math.min(6, howMany));
  const seen = new Set([norm(variants(correct)[0] ?? correct)]);
  const out = [variants(correct)[0] ?? correct];
  for (const v of shuffle(pool)) {
    if (out.length >= want) break;
    const candidate = variants(v[field])[0];
    if (!candidate) continue;
    const key = norm(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(candidate);
  }
  return shuffle(out);
}

export const emptySetup = (total: number): VerbSetup => ({
  from: 1,
  to: Math.min(total, 20) || 1,
  direction: "oboje",
  answer: "vyber",
  options: 4,
  drill: "oboje",
  count: 15,
});

/** Sedí rozsah? Vracia text chyby, aby ho obrazovka vedela ukázať pri poli. */
export function rangeError(from: number, to: number, total: number): string | null {
  if (!Number.isInteger(from) || !Number.isInteger(to)) return "Zadaj celé čísla.";
  if (from < 1) return "Prvé číslo musí byť aspoň 1.";
  if (to > total) return `V zozname je ${total} slovies, viac sa vybrať nedá.`;
  if (from > to) return "Prvé číslo musí byť menšie alebo rovnaké ako druhé.";
  return null;
}
