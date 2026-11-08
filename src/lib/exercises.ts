/**
 * Typy cvičení. Pridať nový typ znamená: doplniť payload sem, schému pre AI, kontrolu a vyhodnotenie,
 * a jeden komponent pre žiaka a jeden pre rodiča. Nič iné v appke sa nemení.
 */
export type ExerciseType = "mcq" | "truefalse" | "pairs" | "cloze" | "order";

export type McqPayload = { question: string; options: string[]; correct: number[]; explain?: string };
export type TrueFalsePayload = { statement: string; answer: boolean; explain?: string };
export type PairsPayload = { prompt?: string; pairs: { left: string; right: string }[] };
/** text s medzerami zapísanými ako ___; answers[i] patrí i-tej medzere */
export type ClozePayload = { text: string; answers: string[]; options: string[]; explain?: string };
export type OrderPayload = { prompt: string; items: string[] };

export type Payload = McqPayload | TrueFalsePayload | PairsPayload | ClozePayload | OrderPayload;

export const GAP = "___";

export const TYPES: { key: ExerciseType; label: string; short: string; help: string }[] = [
  { key: "mcq", label: "Výber z možností", short: "Výber", help: "Otázka a niekoľko možností. Správne môžu byť aj dve, dieťa to vopred vie." },
  { key: "truefalse", label: "Pravda alebo nepravda", short: "Pravda/nepravda", help: "Tvrdenie, ktoré dieťa posúdi." },
  { key: "pairs", label: "Spájanie dvojíc", short: "Dvojice", help: "Napríklad osobnosť a rok, pojem a význam." },
  { key: "cloze", label: "Doplňovačka v texte", short: "Doplňovačka", help: "Veta z lekcie s vynechaným kľúčovým slovom." },
  { key: "order", label: "Usporiadanie", short: "Poradie", help: "Zoradenie udalostí alebo krokov v správnom poradí." },
];

export const typeLabel = (t: string) => TYPES.find((x) => x.key === t)?.label ?? t;
export const isType = (t: string): t is ExerciseType => TYPES.some((x) => x.key === t);

const str = (v: unknown, max = 400) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const uniq = (a: string[]) => new Set(a.map((x) => x.toLocaleLowerCase("sk"))).size === a.length;
export const gapCount = (text: string) => text.split(GAP).length - 1;

/** Očistí, čo prišlo z AI alebo z formulára. Vráti null, keď sa cvičenie nedá použiť. */
export function cleanPayload(type: ExerciseType, raw: unknown): Payload | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (type === "mcq") {
    const question = str(r.question, 300);
    const options = list(r.options)
      .map((o) => str(o, 160))
      .filter(Boolean);
    const correct = [
      ...new Set(
        list(r.correct)
          .map((n) => Number(n))
          .filter((n) => Number.isInteger(n) && n >= 0 && n < options.length),
      ),
    ].sort();
    if (!question || options.length < 2 || options.length > 6 || !uniq(options)) return null;
    if (!correct.length || correct.length >= options.length) return null;
    return { question, options, correct, explain: str(r.explain, 300) || undefined };
  }
  if (type === "truefalse") {
    const statement = str(r.statement, 300);
    if (!statement || typeof r.answer !== "boolean") return null;
    return { statement, answer: r.answer, explain: str(r.explain, 300) || undefined };
  }
  if (type === "pairs") {
    const pairs = list(r.pairs)
      .map((p) => ({ left: str((p as Record<string, unknown>)?.left, 80), right: str((p as Record<string, unknown>)?.right, 80) }))
      .filter((p) => p.left && p.right);
    if (pairs.length < 3 || pairs.length > 6) return null;
    if (!uniq(pairs.map((p) => p.left)) || !uniq(pairs.map((p) => p.right))) return null;
    return { prompt: str(r.prompt, 160) || undefined, pairs };
  }
  if (type === "cloze") {
    const text = str(r.text, 400);
    const answers = list(r.answers)
      .map((a) => str(a, 80))
      .filter(Boolean);
    const gaps = gapCount(text);
    if (!text || gaps < 1 || gaps > 4 || answers.length !== gaps) return null;
    const extra = list(r.options)
      .map((o) => str(o, 80))
      .filter(Boolean);
    const options = [...new Set([...answers, ...extra])];
    if (options.length < answers.length + 1 || options.length > 8) return null;
    return { text, answers, options, explain: str(r.explain, 300) || undefined };
  }
  const prompt = str(r.prompt, 200);
  const items = list(r.items)
    .map((i) => str(i, 120))
    .filter(Boolean);
  if (!prompt || items.length < 3 || items.length > 6 || !uniq(items)) return null;
  return { prompt, items };
}

/** Odpoveď dieťaťa pre jednotlivé typy. */
export type Answer =
  | { type: "mcq"; picked: number[] }
  | { type: "truefalse"; picked: boolean }
  | { type: "pairs"; matched: [number, number][] }
  | { type: "cloze"; filled: string[] }
  | { type: "order"; order: number[] };

const same = (a: string, b: string) => a.trim().toLocaleLowerCase("sk") === b.trim().toLocaleLowerCase("sk");

export function isCorrect(type: ExerciseType, payload: Payload, answer: Answer): boolean {
  if (type === "mcq" && answer.type === "mcq") {
    const p = payload as McqPayload;
    return answer.picked.length === p.correct.length && answer.picked.every((i) => p.correct.includes(i));
  }
  if (type === "truefalse" && answer.type === "truefalse") return (payload as TrueFalsePayload).answer === answer.picked;
  if (type === "pairs" && answer.type === "pairs") {
    const p = payload as PairsPayload;
    return answer.matched.length === p.pairs.length && answer.matched.every(([l, r]) => l === r);
  }
  if (type === "cloze" && answer.type === "cloze") {
    const p = payload as ClozePayload;
    return p.answers.every((a, i) => same(a, answer.filled[i] ?? ""));
  }
  if (type === "order" && answer.type === "order") {
    const p = payload as OrderPayload;
    return answer.order.length === p.items.length && answer.order.every((v, i) => v === i);
  }
  return false;
}

/** Krátky text cvičenia pre zoznamy a súhrn. */
/**
 * Aspekt = o akú časť učiva cvičenie ide. Rodič niektoré vypne, keď ich
 * učiteľ neskúša — typicky letopočty — a žiak dostane oznam, že sa ich
 * učiť nemusí. Delenie je rovnaké pre všetky predmety, len sa inak napĺňa.
 */
export type Aspect = "roky" | "cisla" | "mena" | "miesta" | "pojmy" | "suvislosti";

export const ASPECTS: { key: Aspect; label: string; hint: string; skip: string }[] = [
  { key: "roky", label: "Letopočty a dátumy", hint: "kedy sa čo stalo", skip: "Letopočty sa učiť nemusíš." },
  { key: "cisla", label: "Čísla a údaje", hint: "rozloha, počty, miery", skip: "Čísla a údaje sa učiť nemusíš." },
  { key: "mena", label: "Mená a osobnosti", hint: "kto je kto", skip: "Mená osobností sa učiť nemusíš." },
  { key: "miesta", label: "Miesta a názvy", hint: "kde sa čo nachádza", skip: "Zemepisné názvy sa učiť nemusíš." },
  { key: "pojmy", label: "Pojmy a výrazy", hint: "čo ktoré slovo znamená", skip: "Odborné pojmy sa učiť nemusíš." },
  { key: "suvislosti", label: "Súvislosti", hint: "príčiny, následky, postupy", skip: "Súvislosti sa učiť nemusíš." },
];

export const ASPECT_KEYS = ASPECTS.map((a) => a.key);

/**
 * Ako sa v tréningu zaobchádza s letopočtami. Učiteľ ich buď skúša, alebo nie,
 * a niekedy sa dieťa potrebuje dobiť práve ony — preto tri režimy, nie vypínač.
 */
export type YearsMode = "vsetko" | "bez" | "len";

export const YEARS_MODES: { value: YearsMode; label: string; hint: string; note: string | null }[] = [
  { value: "vsetko", label: "Všetko", hint: "letopočty aj zvyšok učiva", note: null },
  { value: "bez", label: "Bez letopočtov", hint: "otázky na roky a dátumy vynechá", note: "Letopočty sa učiť nemusíš." },
  { value: "len", label: "Len letopočty", hint: "skúša iba roky a dátumy", note: "Teraz sa učíš len letopočty." },
];

export const yearsModeDef = (m: string) => YEARS_MODES.find((x) => x.value === m) ?? YEARS_MODES[0];

/** Prejde cvičenie cez zvolený režim letopočtov? */
export const matchesYears = (aspect: Aspect, mode: YearsMode) => (mode === "vsetko" ? true : mode === "len" ? aspect === "roky" : aspect !== "roky");
export const aspectDef = (a: string) => ASPECTS.find((x) => x.key === a);
export const isAspect = (v: unknown): v is Aspect => typeof v === "string" && (ASPECT_KEYS as string[]).includes(v);

export function preview(type: ExerciseType, payload: Payload): string {
  if (type === "mcq") return (payload as McqPayload).question;
  if (type === "truefalse") return (payload as TrueFalsePayload).statement;
  if (type === "pairs") return ((payload as PairsPayload).prompt ?? "Spoj dvojice") + ": " + (payload as PairsPayload).pairs.map((p) => p.left).join(", ");
  if (type === "cloze") return (payload as ClozePayload).text.replaceAll(GAP, "…");
  return (payload as OrderPayload).prompt;
}

/**
 * Správna odpoveď rozpísaná po riadkoch — jedna odpoveď na riadok.
 * Žiak si po chybe potrebuje riešenie prečítať, a zlepené do jedného odseku sa to nedá.
 */
export function solutionLines(type: ExerciseType, payload: Payload): string[] {
  if (type === "mcq") {
    const p = payload as McqPayload;
    return p.correct.map((i) => p.options[i]);
  }
  if (type === "truefalse") return [(payload as TrueFalsePayload).answer ? "pravda" : "nepravda"];
  if (type === "pairs") return (payload as PairsPayload).pairs.map((p) => `${p.left} – ${p.right}`);
  if (type === "cloze") {
    const p = payload as ClozePayload;
    let i = 0;
    return [p.text.replaceAll(GAP, () => p.answers[i++] ?? GAP)];
  }
  return (payload as OrderPayload).items.map((x, i) => `${i + 1}. ${x}`);
}

/** Tá istá odpoveď na jeden riadok — do zoznamov a náhľadov, kde nie je miesto. */
export const solution = (type: ExerciseType, payload: Payload) => solutionLines(type, payload).join(type === "mcq" ? ", " : " · ");

export function explainOf(type: ExerciseType, payload: Payload): string | undefined {
  if (type === "mcq") return (payload as McqPayload).explain;
  if (type === "truefalse") return (payload as TrueFalsePayload).explain;
  if (type === "cloze") return (payload as ClozePayload).explain;
  return undefined;
}

/** JSON schémy, podľa ktorých AI vracia cvičenia. */
export const AI_SCHEMA: Record<ExerciseType, Record<string, unknown>> = {
  mcq: {
    type: "object",
    properties: {
      question: { type: "string", description: "otázka v slovenčine" },
      options: { type: "array", items: { type: "string" }, description: "3 alebo 4 možnosti, všetky vierohodné" },
      correct: { type: "array", items: { type: "integer" }, description: "indexy správnych možností od 0, väčšinou jeden, niekedy dva" },
      explain: { type: "string", description: "jedna veta, prečo je to tak" },
      concept: { type: "string", description: "téma otázky, 1 až 3 slová" },
      level: { type: "integer", description: "1 priamo z textu, 2 spojenie dvoch faktov, 3 záludná" },
      aspect: { type: "string", description: "roky, cisla, mena, miesta, pojmy alebo suvislosti" },
    },
    required: ["question", "options", "correct", "explain", "concept", "level", "aspect"],
  },
  truefalse: {
    type: "object",
    properties: {
      statement: { type: "string", description: "tvrdenie, ktoré je buď pravdivé, alebo jemne zmenené" },
      answer: { type: "boolean" },
      explain: { type: "string", description: "jedna veta s vysvetlením" },
      concept: { type: "string" },
      level: { type: "integer" },
      aspect: { type: "string", description: "roky, cisla, mena, miesta, pojmy alebo suvislosti" },
    },
    required: ["statement", "answer", "explain", "concept", "level", "aspect"],
  },
  pairs: {
    type: "object",
    properties: {
      prompt: { type: "string", description: "napr. Spoj panovníka s rokom korunovácie" },
      pairs: {
        type: "array",
        description: "4 dvojice",
        items: { type: "object", properties: { left: { type: "string" }, right: { type: "string" } }, required: ["left", "right"] },
      },
      concept: { type: "string" },
      level: { type: "integer" },
      aspect: { type: "string", description: "roky, cisla, mena, miesta, pojmy alebo suvislosti" },
    },
    required: ["prompt", "pairs", "concept", "level", "aspect"],
  },
  cloze: {
    type: "object",
    properties: {
      text: { type: "string", description: "veta z lekcie s jednou alebo dvoma medzerami zapísanými ako ___" },
      answers: { type: "array", items: { type: "string" }, description: "slová do medzier v poradí" },
      options: { type: "array", items: { type: "string" }, description: "ponuka slov: správne plus 2 až 3 nesprávne" },
      explain: { type: "string" },
      concept: { type: "string" },
      level: { type: "integer" },
      aspect: { type: "string", description: "roky, cisla, mena, miesta, pojmy alebo suvislosti" },
    },
    required: ["text", "answers", "options", "explain", "concept", "level", "aspect"],
  },
  order: {
    type: "object",
    properties: {
      prompt: { type: "string", description: "napr. Zoraď udalosti od najstaršej" },
      items: { type: "array", items: { type: "string" }, description: "4 položky v SPRÁVNOM poradí" },
      concept: { type: "string" },
      level: { type: "integer" },
      aspect: { type: "string", description: "roky, cisla, mena, miesta, pojmy alebo suvislosti" },
    },
    required: ["prompt", "items", "concept", "level", "aspect"],
  },
};
