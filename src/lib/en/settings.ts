import type { ActivityKey, ChildSettings, MethodKey, Questionnaire } from "./types";

export const DEFAULT_METHODS: Record<MethodKey, boolean> = {
  classic: true,
  flashcards: true,
  match: false,
  scramble: false,
  dictation: false,
  speed: false,
  shadowing: false,
  dualCoding: false,
  gamification: false,
};

export const DEFAULT_SETTINGS: ChildSettings = {
  voice: "female",
  encouragement: true,
  motivation: true,
  answerMode: "written",
  direction: "en_sk",
  hintMode: "blanks",
  grammarMode: "choice",
  wordsPerSession: 12,
  slowSpeech: false,
  dailyGoal: 20,
  methods: DEFAULT_METHODS,
};

export function mergeSettings(s: Partial<ChildSettings> | null | undefined): ChildSettings {
  const methods = { ...DEFAULT_METHODS };
  for (const k of Object.keys(DEFAULT_METHODS) as MethodKey[]) if (typeof s?.methods?.[k] === "boolean") methods[k] = s.methods[k];
  return { ...DEFAULT_SETTINGS, ...(s ?? {}), methods };
}

export type MethodInfo = {
  key: MethodKey;
  label: string;
  what: string;
  why: string;
  kind: "activity" | "modifier";
  core?: boolean;
};

/** Teaching methods. Core = the default "classic + flashcards"; the rest are switched on per child. */
export const METHODS: MethodInfo[] = [
  {
    key: "classic",
    label: "Klasické precvičovanie",
    what: "Dieťa vidí slovíčko a napíše alebo povie preklad. Chyby sa vracajú častejšie.",
    why: "Aktívne vybavovanie si z pamäti je najúčinnejší spôsob, ako si slovíčko zapamätať.",
    kind: "activity",
    core: true,
  },
  {
    key: "flashcards",
    label: "Kartičky",
    what: "Slovíčko na prednej strane, preklad a veta na zadnej. Dieťa samo ohodnotí, či vedelo.",
    why: "Rýchle zoznámenie s novými slovíčkami a sebahodnotenie, ktoré učí odhadnúť, čo už vie.",
    kind: "activity",
    core: true,
  },
  {
    key: "match",
    label: "Spájanie dvojíc",
    what: "Hra: spoj anglické slovíčko so slovenským prekladom.",
    why: "Hravá forma rozpoznávania, vhodná na rozcvičenie alebo pre deti, ktoré baví súťaženie.",
    kind: "activity",
  },
  {
    key: "scramble",
    label: "Poskladaj slovo",
    what: "Písmenká anglického slovíčka sú pomiešané, dieťa ich poskladá v správnom poradí.",
    why: "Precvičí pravopis bez písania na klávesnici, dobré pre mladšie deti.",
    kind: "activity",
  },
  {
    key: "dictation",
    label: "Diktát",
    what: "Appka slovíčko povie, dieťa ho napíše po anglicky.",
    why: "Spája zvuk s pravopisom, čo je v angličtine najväčší problém.",
    kind: "activity",
  },
  {
    key: "speed",
    label: "Blesková runda",
    what: "60 sekúnd, rýchly výber správneho prekladu zo štyroch možností.",
    why: "Buduje plynulosť, slovíčka si dieťa vybaví bez rozmýšľania.",
    kind: "activity",
  },
  {
    key: "shadowing",
    label: "Opakuj po mne",
    what: "Appka povie vetu, dieťa ju zopakuje nahlas. Funguje cez mikrofón.",
    why: "Tieňovanie zlepšuje výslovnosť aj rytmus reči.",
    kind: "activity",
  },
  {
    key: "dualCoding",
    label: "Obrázok k slovíčku",
    what: "Ku každému slovíčku sa zobrazí emoji obrázok.",
    why: "Slovo plus obraz sa pamätá lepšie ako samotné slovo.",
    kind: "modifier",
  },
  {
    key: "gamification",
    label: "Body a séria dní",
    what: "Body za správne odpovede, séria dní a denný cieľ.",
    why: "Motivuje k pravidelnosti, ktorá je dôležitejšia ako dĺžka tréningu.",
    kind: "modifier",
  },
];

export const ACTIVITIES: { key: ActivityKey; label: string; method?: MethodKey; scored: boolean }[] = [
  { key: "flashcards", label: "Kartičky", method: "flashcards", scored: true },
  { key: "classic", label: "Slovíčka", method: "classic", scored: true },
  { key: "match", label: "Spájanie dvojíc", method: "match", scored: true },
  { key: "scramble", label: "Poskladaj slovo", method: "scramble", scored: true },
  { key: "dictation", label: "Diktát", method: "dictation", scored: true },
  { key: "speed", label: "Blesková runda", method: "speed", scored: true },
  { key: "shadowing", label: "Opakuj po mne", method: "shadowing", scored: false },
  { key: "grammar", label: "Gramatika", scored: true },
  { key: "writing", label: "Písanie viet", scored: true },
  { key: "reading", label: "Čítanie", scored: false },
  { key: "listening", label: "Počúvanie", scored: false },
];

export const activityLabel = (k: ActivityKey) => ACTIVITIES.find((a) => a.key === k)?.label ?? k;

/** Čo má dieťa s touto aktivitou robiť — text za otáznikom v tréningu. */
const KID_HELP: Record<ActivityKey, { what: string; how: string }> = {
  flashcards: {
    what: "Spomeň si, čo slovíčko znamená, a potom kartičku otoč.",
    how: "Po otočení si úprimne povedz, ako ti to išlo: Neviem, Takmer alebo Viem. Podľa toho ti appka slovíčko zopakuje skôr alebo neskôr.",
  },
  classic: { what: "Prelož slovíčko a napíš odpoveď.", how: "Keď sa pomýliš, dostaneš ešte jeden pokus. Pomôcť si môžeš vypočutím slova." },
  match: { what: "Spoj slovíčka s ich prekladom.", how: "Klikni na slovo vľavo a potom na jeho preklad vpravo. Keď dvojica sedí, zmizne." },
  scramble: { what: "Písmenká sú pomiešané, poskladaj z nich slovo.", how: "Klikaj na písmenká v správnom poradí. Posledné vybraté vieš vrátiť späť." },
  dictation: { what: "Vypočuj si slovo a napíš ho.", how: "Vypočuť si ho môžeš aj viackrát, klikni na reproduktor." },
  speed: { what: "Rýchla runda: vyber správny preklad, kým beží čas.", how: "Nemusíš stihnúť všetko, ide o to, čo ti už ide samo." },
  shadowing: { what: "Vypočuj si vetu a zopakuj ju nahlas po nej.", how: "Nič sa nehodnotí, ide o výslovnosť. Klikni na Ďalej, keď si hotový." },
  grammar: { what: "Doplň do vety chýbajúce slovo.", how: "Buď vyberieš z možností, alebo slovo napíšeš. Pri chybe uvidíš, ako to má byť." },
  writing: { what: "Poskladaj z ponúknutých slov celú vetu.", how: "Klikaj na slová v poradí, v akom idú vo vete. Posledné vieš vrátiť späť." },
  reading: { what: "Prečítaj si text po vetách.", how: "Preklad si zobrazíš klepnutím, nič sa nehodnotí." },
  listening: { what: "Počúvaj vety a sleduj preklad.", how: "Nič sa nehodnotí, ide o to zvyknúť si na angličtinu." },
};

export const activityHelp = (k: ActivityKey) => ({ title: activityLabel(k), ...(KID_HELP[k] ?? { what: "Postupuj podľa zadania.", how: "" }) });

export const SKILLS = ["Slovíčka", "Pravopis", "Výslovnosť", "Počúvanie", "Čítanie", "Gramatika", "Rozprávanie"];
export const LIKES = ["Hry", "Súťaženie", "Rýchle úlohy", "Obrázky", "Pokojné tempo"];

export const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9];
export const gradeLabel = (g: number) => `${g}. trieda`;

export const LEVELS: { value: "zaciatocnik" | "mierne_pokrocily" | "pokrocily"; label: string }[] = [
  { value: "zaciatocnik", label: "Začiatočník" },
  { value: "mierne_pokrocily", label: "Mierne pokročilý" },
  { value: "pokrocily", label: "Pokročilý" },
];

export const AVATARS = ["🦊", "🐼", "🐯", "🦁", "🐸", "🐙", "🦄", "🐧", "🐨", "🦖", "🐬", "🦉"];

/** Suggest methods & settings from the parent questionnaire. Deterministic and explainable. */
export function recommendSettings(q: Questionnaire, current: ChildSettings): { settings: ChildSettings; reasons: string[] } {
  const m = { ...current.methods };
  const reasons: string[] = [];
  const weak = new Set(q.weaknesses ?? []);
  const likes = new Set(q.likes ?? []);
  let words = current.wordsPerSession;
  let hint = current.hintMode;

  if (weak.has("Pravopis")) {
    m.scramble = true;
    m.dictation = true;
    hint = "reveal";
    reasons.push("Slabší pravopis: zapnuté Poskladaj slovo a Diktát, nápoveda postupným odkrývaním.");
  }
  if (weak.has("Počúvanie")) {
    m.dictation = true;
    reasons.push("Slabšie počúvanie: zapnutý Diktát. Pri textoch lekcie zapni aj Počúvanie.");
  }
  if (weak.has("Výslovnosť") || weak.has("Rozprávanie")) {
    m.shadowing = true;
    reasons.push("Výslovnosť a rozprávanie: zapnuté Opakuj po mne.");
  }
  if (weak.has("Slovíčka")) {
    m.classic = true;
    m.scramble = true;
    reasons.push("Slabšie slovíčka: zapnuté Klasické precvičovanie a Poskladaj slovo.");
  }
  if (likes.has("Hry") || likes.has("Súťaženie")) {
    m.match = true;
    m.gamification = true;
    reasons.push("Baví ho/ju hra a súťaženie: zapnuté Spájanie dvojíc a body so sériou dní.");
  }
  if (likes.has("Rýchle úlohy")) {
    m.speed = true;
    reasons.push("Má rád/a rýchle úlohy: zapnutá Blesková runda.");
  }
  if (likes.has("Obrázky")) {
    m.dualCoding = true;
    reasons.push("Má rád/a obrázky: zapnutý obrázok k slovíčku.");
  }
  if (q.attention === "short") {
    words = 8;
    reasons.push("Kratšia pozornosť: 8 slovíčok na tréning.");
  } else if (q.attention === "long") {
    words = 20;
    reasons.push("Dlhšia pozornosť: 20 slovíčok na tréning.");
  }
  if (reasons.length === 0) reasons.push("Dotazník nemení predvolené nastavenie: klasika a kartičky.");
  return { settings: { ...current, methods: m, wordsPerSession: words, hintMode: hint }, reasons };
}
