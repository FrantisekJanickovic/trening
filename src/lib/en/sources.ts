import type { LessonSource, SourceType } from "./types";

export const SOURCE_TYPES: { value: SourceType; label: string; hint: string }[] = [
  { value: "vocab", label: "Slovíčka", hint: "Kartičky, precvičovanie, diktát a ďalšie hry so slovíčkami" },
  { value: "grammar", label: "Gramatika", hint: "Doplňovačka: výber z možností alebo ručné doplnenie" },
  { value: "reading", label: "Čítanie", hint: "Text po vetách, ťuknutím sa zobrazí preklad" },
  { value: "listening", label: "Počúvanie", hint: "Appka prečíta vetu a potom jej preklad" },
  { value: "writing", label: "Písanie viet", hint: "Dieťa skladá anglické vety zo slov" },
  { value: "skip", label: "Nepoužiť", hint: "Cvičenie sa do appky nepridá" },
];

export const ALL_SOURCE_TYPES = SOURCE_TYPES.map((t) => t.value);

export const sourceTypeLabel = (t: SourceType) => SOURCE_TYPES.find((x) => x.value === t)?.label ?? t;

/** Types that produce content (everything except "skip"). */
export const effective = (t: readonly SourceType[] | null | undefined) => (t ?? []).filter((x) => x !== "skip");

export const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** Keep only known types, in canonical order; "skip" excludes everything else. */
export function cleanTypes(t: readonly string[] | null | undefined): SourceType[] {
  const set = new Set((t ?? []).filter((x): x is SourceType => (ALL_SOURCE_TYPES as string[]).includes(x)));
  if (set.has("skip")) return ["skip"];
  return ALL_SOURCE_TYPES.filter((x) => set.has(x));
}

/** True when the exercise needs (re)generating to match its chosen types. */
export function isPending(s: Pick<LessonSource, "types" | "applied_types">) {
  if (s.applied_types === null) return effective(s.types).length > 0;
  return !sameSet(effective(s.types), effective(s.applied_types));
}

export type SourceStatus = { label: string; tone: "todo" | "done" | "changed" | "skip" | "empty" };

export function sourceStatus(s: Pick<LessonSource, "types" | "applied_types">): SourceStatus {
  const eff = effective(s.types);
  const applied = effective(s.applied_types);
  if (!eff.length) {
    if (applied.length) return { label: "Cvičenia sa odstránia", tone: "changed" };
    if (s.types.includes("skip")) return { label: "Nepoužije sa", tone: "skip" };
    return { label: "Vyber typ", tone: "empty" };
  }
  if (s.applied_types === null) return { label: "Čaká na vytvorenie", tone: "todo" };
  if (!sameSet(eff, applied)) return { label: "Zmenené, vytvorí sa znova", tone: "changed" };
  return { label: "Vytvorené", tone: "done" };
}
