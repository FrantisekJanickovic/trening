/**
 * Predmety. Pridať ďalší predmet znamená pridať sem položku a riadok do tabuľky tr_subjects;
 * engine (import, generovanie, tréning, chyby, história) ostáva nezmenený.
 */
export type SubjectSlug = "dejepis" | "geografia" | "chemia" | "biologia" | "vlastiveda" | "slovesa" | "anglictina";

export type SubjectDef = {
  slug: SubjectSlug;
  name: string;
  icon: string;
  /** what the AI should pay attention to in this subject */
  hint: string;
  /**
   * "lessons" je bežný predmet: nafotené lekcie a cvičenia z nich.
   * "verbs" je očíslovaný zoznam slovies s vlastnou správou aj tréningom.
   * "english" má vlastný engine (slovíčka, gramatika, texty, počúvanie) a vlastné obrazovky.
   */
  kind?: "lessons" | "verbs" | "english";
};

export const SUBJECTS: SubjectDef[] = [
  {
    slug: "dejepis",
    name: "Dejepis",
    icon: "🏰",
    hint: "Dôležité sú letopočty a poradie udalostí, panovníci a osobnosti, príčiny a následky, dobové pojmy a miesta. Pri otázkach na roky používaj mätúce možnosti z rovnakého obdobia.",
  },
  {
    slug: "geografia",
    name: "Geografia",
    icon: "🗺️",
    hint: "Dôležité sú polohy, názvy a dvojice (štát a hlavné mesto, rieka a pohorie), čísla ako rozloha a počet obyvateľov, podnebie a hospodárstvo.",
  },
  {
    slug: "chemia",
    name: "Chémia",
    icon: "⚗️",
    hint: "Dôležité sú značky a názvy prvkov, vzorce zlúčenín, vlastnosti látok, jednoduché rovnice a bezpečnosť pri pokusoch.",
  },
  {
    slug: "biologia",
    name: "Biológia",
    icon: "🌿",
    hint: "Dôležité sú stavba a funkcia orgánov, zaraďovanie organizmov do skupín, procesy ako fotosyntéza a dýchanie, odborné pojmy a ich význam.",
  },
  {
    slug: "vlastiveda",
    name: "Vlastiveda",
    icon: "🧭",
    hint: "Učivo mieša poznatky o Slovensku, prírode a dejinách pre mladšie deti. Dôležité sú kraje, mestá, rieky a pohoria, významné osobnosti a povesti, tradície a sviatky, orientácia v krajine a na mape, svetové strany. Otázky stavaj z toho, čo dieťa pozná zo svojho okolia, a jazyk drž jednoduchý.",
  },
  {
    slug: "anglictina",
    name: "Angličtina",
    icon: "🇬🇧",
    kind: "english",
    hint: "Anglické slovíčka, gramatika a texty z učebnice.",
  },
  {
    slug: "slovesa",
    name: "Nepravidelné slovesá",
    icon: "🔤",
    kind: "verbs",
    hint: "Anglické nepravidelné slovesá: základný tvar, minulý čas, minulé príčastie a slovenský význam.",
  },
];

export const subjectDef = (slug: string) => SUBJECTS.find((s) => s.slug === slug);
export const isVerbSubject = (slug: string) => subjectDef(slug)?.kind === "verbs";
/** Angličtina má vlastné obrazovky, do spoločného enginu cvičení nevstupuje. */
export const isEnglishSubject = (slug: string) => subjectDef(slug)?.kind === "english";
export const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9];
export const gradeLabel = (g: number) => `${g}. trieda`;
