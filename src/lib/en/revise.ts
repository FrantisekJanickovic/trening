/** Pokyn pre AI k jednej položke lekcie angličtiny — zdieľa appka aj API. */

export type ItemKind = "vocab" | "grammar" | "text";

/** Položka, na ktorú sa rodič odvolal kódom v prompte. */
export type Ref = { code: string; kind: ItemKind; text: string };

export const ACTIONS: Record<string, { label: string; rule: string; kinds: ItemKind[] }> = {
  oprava: {
    label: "Skontroluj preklad",
    rule: `Check this item: spelling, diacritics, grammar and whether the Slovak really matches the English. Fix what is wrong and return the corrected item in "fixed". Do not change its meaning and do not create new items.`,
    kinds: ["vocab", "grammar", "text"],
  },
  vety: {
    label: "Doplň príkladové vety",
    rule: `Write a short English example sentence that uses this word, plus its Slovak translation, and return the completed item in "fixed". Keep "en" and "sk" exactly as they are. Do not create new items.`,
    kinds: ["vocab"],
  },
  podobne: {
    label: "Pridaj podobné slovíčka",
    rule: `Create new vocabulary items from the same topic and of the same difficulty as the example. Fill in an example sentence and an emoji for each. Leave "fixed" empty.`,
    kinds: ["vocab"],
  },
  variacie: {
    label: "Pridaj viac variácií",
    rule: `Create new gap-fill exercises that drill the same grammar as the example, with different sentences. Leave "fixed" empty.`,
    kinds: ["grammar"],
  },
  vysvetli: {
    label: "Vysvetli po slovensky",
    rule: `Write a short, child-friendly Slovak explanation of the rule this exercise drills into "explanation_sk", and the Slovak translation of the sentence into "translation_sk". Return the completed item in "fixed" and change nothing else.`,
    kinds: ["grammar"],
  },
  lahsie: {
    label: "Zjednoduš pre mladšie dieťa",
    rule: `Rewrite this item with simpler words and shorter sentences, one school year easier, keeping its meaning and topic. Return it in "fixed". Do not create new items.`,
    kinds: ["text", "grammar"],
  },
  doplnvety: {
    label: "Pridaj vety do textu",
    rule: `Add further sentences that continue this text naturally, each with its Slovak translation, and return the whole text including the new sentences in "fixed". Do not create new items.`,
    kinds: ["text"],
  },
  volny: { label: "Vlastný pokyn", rule: `Do exactly what the parent asks.`, kinds: ["vocab", "grammar", "text"] },
};

/** Predvoľby, ktoré dávajú zmysel pre daný druh položky. */
export const actionsFor = (kind: ItemKind) =>
  Object.entries(ACTIONS)
    .filter(([key, a]) => key !== "volny" && a.kinds.includes(kind))
    .map(([key, a]) => ({ key, label: a.label }));

/** Kód položky: 6 znakov bez zameniteľných núl a jednotiek. */
export const CODE_RE = /\b[2-9A-HJ-NP-Z]{6}\b/g;

/**
 * Kódy, na ktoré sa rodič mohol odvolať v prompte. Vracia kandidátov —
 * volajúci ich preosieva cez kódy, ktoré lekcia naozaj má, inak by sa
 * chytilo aj bežné slovo.
 */
export const codesIn = (text: string) => [...new Set(text.toUpperCase().match(CODE_RE) ?? [])].slice(0, 10);

export type VocabOut = { en: string; sk: string; example_en: string; example_sk: string; emoji: string };
export type GrammarOut = { prompt: string; answer: string; options: string[]; translation_sk: string; explanation_sk: string };
export type TextOut = { title: string; sentences: { en: string; sk: string }[] };

export type Revision = { note: string; fixed: Record<string, unknown> | null; items: Record<string, unknown>[] };
