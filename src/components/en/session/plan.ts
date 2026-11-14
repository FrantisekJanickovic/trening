import { grammarEntry, itemKey, sentenceEntry, vocabEntry, type CatalogEntry } from "@/lib/en/problems";
import { priority } from "@/lib/en/srs";
import { displayAnswer, shuffle } from "@/lib/en/text";
import type { ActivityKey, ChildSettings, GrammarItem, ItemProgress, LessonText, Sentence, VocabItem } from "@/lib/en/types";
import { sentenceWords, type WritingItem } from "./activities/Writing";
import { toDrill, type DrillItem } from "./engine";

export type Step =
  | { key: "flashcards" | "classic" | "match" | "scramble" | "dictation" | "speed"; vocab: DrillItem[] }
  | { key: "shadowing" | "listening"; sentences: Sentence[] }
  | { key: "grammar"; grammar: GrammarItem[] }
  | { key: "writing"; writing: WritingItem[] }
  | { key: "reading"; texts: LessonText[] };

export type Plan = {
  steps: Step[];
  /** all words of the chosen lessons, used for wrong options in the speed round */
  pool: DrillItem[];
  catalog: Map<string, CatalogEntry>;
  lessonTitles: string[];
  /** how many questions came from previous lessons */
  reviewCount: number;
};

export type PlanInput = {
  vocab: VocabItem[];
  grammar: GrammarItem[];
  texts: LessonText[];
  review: { vocab: VocabItem[]; grammar: GrammarItem[]; sentences: WritingItem[] };
  settings: ChildSettings;
  progress: Map<string, ItemProgress>;
  lessonTitles: string[];
};

const LIMITS = { grammar: 8, writing: 6, listening: 8, shadowing: 6 };
const usedFor = (t: LessonText, u: "reading" | "listening" | "writing") => (t.uses?.length ? t.uses : ["reading", "listening"]).includes(u);
const scrambleable = (v: VocabItem) => {
  const w = displayAnswer(v.en);
  return w.length <= 16 && /^[a-z' -]+$/i.test(w);
};

/** Shuffle, then rank by spaced-repetition priority (due problems first); equal ranks stay random. */
const ranked = <T extends { id: string }>(items: T[], progress: Map<string, ItemProgress>) =>
  shuffle(items).sort((a, b) => priority(progress.get(a.id)) - priority(progress.get(b.id)));

function chunks<T>(items: T[], size: number, min = 2): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  if (out.length > 1 && out[out.length - 1].length < min) out[out.length - 2].push(...out.pop()!);
  return out;
}

const uniqueBy = <T>(items: T[], key: (t: T) => string) => [...new Map(items.map((i) => [key(i), i])).values()];

/** Random order, avoiding the same kind of exercise twice in a row where possible. */
export function arrange(steps: Step[]): Step[] {
  const pool = shuffle(steps);
  const out: Step[] = [];
  while (pool.length) {
    const last = out[out.length - 1]?.key;
    const counts = new Map<string, number>();
    for (const st of pool) counts.set(st.key, (counts.get(st.key) ?? 0) + 1);
    const [top, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    // the most frequent kind must go now if it would otherwise run out of gaps
    const forced = top !== last && topCount * 2 > pool.length ? top : null;
    let i = pool.findIndex((st) => (forced ? st.key === forced : st.key !== last));
    if (i < 0) i = 0;
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

/**
 * Build a training: short blocks of each enabled exercise kind, with items mixed across all chosen lessons
 * and the questions picked for review from previous lessons, in a random order every time.
 */
export function buildPlan(input: PlanInput): Plan {
  const { settings: s, progress, review } = input;
  const m = s.methods;

  const limit = s.wordsPerSession || input.vocab.length;
  const words = shuffle(uniqueBy([...ranked(input.vocab, progress).slice(0, limit), ...review.vocab], (v) => v.id));
  const grammar = shuffle(uniqueBy([...ranked(input.grammar, progress).slice(0, LIMITS.grammar), ...review.grammar], (g) => g.id));

  const lessonSentences: WritingItem[] = input.texts
    .filter((t) => usedFor(t, "writing"))
    .flatMap((t) => t.sentences.map((x, i) => ({ id: x.id ?? `${t.id}-${i}`, en: x.en, sk: x.sk, lesson_id: t.lesson_id, key: "" })))
    .filter((x) => sentenceWords(x.en).length >= 2);
  const writing = shuffle(uniqueBy([...ranked(lessonSentences, progress).slice(0, LIMITS.writing), ...review.sentences], (x) => x.id)).map((x, i) => ({
    ...x,
    key: `${x.id}-${i}`,
  }));

  const readingTexts = shuffle(input.texts.filter((t) => usedFor(t, "reading") && t.sentences.length)).slice(0, 1);
  const listenText = shuffle(input.texts.filter((t) => usedFor(t, "listening") && t.sentences.length))[0];
  const listening = listenText ? listenText.sentences.slice(0, LIMITS.listening) : [];
  const shadow: Sentence[] = words
    .filter((v) => v.example_en)
    .slice(0, LIMITS.shadowing)
    .map((v) => ({ en: v.example_en!, sk: v.example_sk ?? "" }));
  if (shadow.length < 3) shadow.push(...listening.slice(0, LIMITS.shadowing - shadow.length));

  const steps: Step[] = [];
  const vocabKinds = (["flashcards", "classic", "match", "scramble", "dictation"] as const).filter((k) => m[k]);
  for (const key of vocabKinds) {
    const items = key === "scramble" ? words.filter(scrambleable) : words;
    if (key === "match" && items.length < 2) continue;
    for (const c of chunks(shuffle(items), key === "match" ? 5 : 4)) steps.push({ key, vocab: toDrill(c, s.direction) });
  }
  if (m.speed && words.length >= 4) steps.push({ key: "speed", vocab: toDrill(words, s.direction) });
  if (m.shadowing && shadow.length) steps.push({ key: "shadowing", sentences: shadow });
  for (const c of chunks(grammar, 4)) steps.push({ key: "grammar", grammar: c });
  for (const c of chunks(writing, 3)) steps.push({ key: "writing", writing: c });
  if (readingTexts.length) steps.push({ key: "reading", texts: readingTexts });
  if (listening.length) steps.push({ key: "listening", sentences: listening });

  const catalog = new Map<string, CatalogEntry>();
  for (const v of [...input.vocab, ...review.vocab]) catalog.set(itemKey("vocab", v.id), vocabEntry(v));
  for (const g of [...input.grammar, ...review.grammar]) catalog.set(itemKey("grammar", g.id), grammarEntry(g));
  for (const x of [...lessonSentences, ...review.sentences]) catalog.set(itemKey("sentence", x.id), sentenceEntry({ ...x, lesson_id: x.lesson_id ?? "" }));

  return {
    steps: arrange(steps),
    pool: toDrill(
      uniqueBy([...input.vocab, ...review.vocab], (v) => v.id),
      s.direction,
    ),
    catalog,
    lessonTitles: input.lessonTitles,
    reviewCount: review.vocab.length + review.grammar.length + review.sentences.length,
  };
}

/** Everything the training will say, so the voice can be prepared before it starts. */
export function phrasesOf(plan: Plan): { text: string; lang: "en" | "sk" }[] {
  const out: { text: string; lang: "en" | "sk" }[] = [];
  const add = (text: string | null | undefined, lang: "en" | "sk") => text && out.push({ text, lang });
  for (const st of plan.steps) {
    if ("vocab" in st)
      for (const v of st.vocab) {
        add(v.en, "en");
        add(v.sk, "sk");
        add(v.example_en, "en");
      }
    if ("grammar" in st) for (const g of st.grammar) add(g.prompt.replace(/_{2,}/, g.answer.split("|")[0].trim()), "en");
    if ("writing" in st) for (const w of st.writing) add(w.en, "en");
    if ("texts" in st) for (const t of st.texts) for (const x of t.sentences) add(x.en, "en");
    if ("sentences" in st)
      for (const x of st.sentences) {
        add(x.en, "en");
        if (st.key === "listening") add(x.sk, "sk");
      }
  }
  return [...new Map(out.map((x) => [`${x.lang}|${x.text}`, x])).values()];
}

export const stepKeys = (plan: Plan): ActivityKey[] => [...new Set(plan.steps.map((s) => s.key))];
