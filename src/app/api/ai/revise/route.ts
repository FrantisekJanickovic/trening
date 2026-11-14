import { GRADES, subjectDef } from "@/data/subjects";
import { AI_SCHEMA, cleanPayload, isType, TYPES, type ExerciseType, type Payload } from "@/lib/exercises";
import { aiConfigured, NOT_CONFIGURED, structured } from "@/lib/openai";
import { requireUser, unauthorized } from "@/lib/server-auth";

export const maxDuration = 300;

type Section = { heading?: string; text?: string };
type Ref = { code?: string; type?: string; text?: string; solution?: string };
type FigureIn = { id?: string; caption?: string; explain?: string };
type In = {
  subject?: string;
  grade?: number | null;
  title?: string;
  sections?: Section[];
  types?: string[];
  count?: number;
  /** čo chce rodič — prednastavený zámer */
  action?: string;
  /** vlastný text rodiča, max 200 znakov */
  instruction?: string;
  target?: { code?: string; type?: string; text?: string; solution?: string; concept?: string; payload?: unknown };
  refs?: Ref[];
  figures?: FigureIn[];
};

export type Revised = { type: ExerciseType; payload: Payload; concept: string; level: number };

/** Prednastavené zámery. Voľný text ich môže spresniť alebo úplne prebiť. */
const ACTIONS: Record<string, { label: string; rule: string }> = {
  gramatika: {
    label: "Skontroluj gramatiku",
    rule: `Oprav v tomto cvičení pravopis, diakritiku, interpunkciu a neobratné vety. Obsah, typ ani správnu odpoveď nemeň. Výsledok daj do "fixed". Nové cvičenia nevyrábaj.`,
  },
  typy: {
    label: "Pridaj ďalšie typy cvičení",
    rule: `Vyrob nové cvičenia na tú istú látku ako predloha, ale INÉHO typu, než je predloha. Vystriedaj čo najviac povolených typov. Predlohu nemeň, "fixed" nechaj prázdne.`,
  },
  variacie: {
    label: "Pridaj viac variácií",
    rule: `Vyrob nové cvičenia ROVNAKÉHO typu ako predloha a na tú istú látku, len s inými otázkami, menami, rokmi či možnosťami. Predlohu nemeň, "fixed" nechaj prázdne.`,
  },
  obrazok: {
    label: "Pridaj obrázok",
    rule: `K predlohe vyber z ponuky obrázkov ten, ktorý k nej sedí, a jeho číslo daj do "figure". Keď nesedí ani jeden, daj 0. Cvičenie inak nemeň a nové nevyrábaj.`,
  },
  volny: { label: "Vlastný pokyn", rule: `Rob presne to, čo žiada pokyn rodiča.` },
};

const str = (v: unknown, max: number) =>
  String(v ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const system = (subject: string, grade: number | null, rule: string, types: ExerciseType[], count: number) => {
  const def = subjectDef(subject);
  return `Upravuješ cvičenia pre žiaka ${grade ? `${grade}. ročníka ` : ""}základnej školy na Slovensku z predmetu ${def?.name ?? subject}.

Dostaneš prepis lekcie, jedno konkrétne cvičenie ako predlohu a pokyn od rodiča.

Čo máš spraviť:
${rule}

Keď vyrábaš nové cvičenia, vyrob ich najviac ${count} a rozdeľ ich medzi povolené typy: ${types.join(", ")}.

Pravidlá:
- Všetko iba z prepisu lekcie. Nič si nevymýšľaj a nepoužívaj vedomosti mimo textu.
- Slovenčina s diakritikou, krátke vety, slovná zásoba primeraná veku.
- Nesprávne možnosti musia byť vierohodné a z rovnakej oblasti.
- Nepoužívaj formulácie ako „podľa textu“ alebo „v učebnici“.
- "concept" je téma cvičenia v 1 až 3 slovách.
- Nové cvičenie nesmie byť kópiou predlohy ani iného cvičenia, ktoré dostaneš.
- Žiadne násilie, alkohol, politické hodnotenia ani nevhodné témy.
- Do "note" napíš jednou vetou po slovensky, čo si spravil. Keď sa pokyn nedá splniť z prepisu, napíš to tam a nič nevyrábaj.
${def ? `\nNa čo si dať pozor v tomto predmete: ${def.hint}` : ""}`;
};

export async function POST(req: Request) {
  if (!aiConfigured()) return Response.json({ error: NOT_CONFIGURED }, { status: 503 });
  const user = await requireUser(req);
  if (!user) return unauthorized();
  const body = (await req.json().catch(() => null)) as In | null;

  const sections = (body?.sections ?? [])
    .map((s) => ({ heading: String(s.heading ?? ""), text: String(s.text ?? "") }))
    .filter((s) => s.text)
    .slice(0, 40);
  if (!sections.length) return Response.json({ error: "Lekcia nemá prepísaný materiál." }, { status: 400 });

  const target = body?.target ?? {};
  const targetType = isType(String(target.type)) ? (String(target.type) as ExerciseType) : null;
  if (!targetType) return Response.json({ error: "Chýba cvičenie, ku ktorému sa pokyn vzťahuje." }, { status: 400 });

  const types = (body?.types ?? []).filter(isType);
  if (!types.length) return Response.json({ error: "Nie je zapnutý žiadny typ cvičenia." }, { status: 400 });
  const count = Math.min(Math.max(Math.round(Number(body?.count) || 4), 1), 20);
  const grade = GRADES.includes(Number(body?.grade)) ? Number(body?.grade) : null;
  const action = ACTIONS[String(body?.action ?? "volny")] ?? ACTIONS.volny;
  const instruction = str(body?.instruction, 200);
  const figures = (body?.figures ?? []).slice(0, 24).map((f) => ({ id: String(f.id ?? ""), caption: str(f.caption, 160), explain: str(f.explain, 200) }));
  const refs = (body?.refs ?? []).slice(0, 10);

  // pri „pridaj obrázok“ bez galérie by AI nemala z čoho vyberať
  if (body?.action === "obrazok" && !figures.length) {
    return Response.json({ error: "Lekcia nemá v galérii žiadne obrázky, z ktorých by sa dalo vyberať." }, { status: 400 });
  }

  const properties: Record<string, unknown> = {
    note: { type: "string", description: "jedna veta po slovensky, čo si spravil" },
    fixed: { ...AI_SCHEMA[targetType], description: "opravená predloha; vynechaj, keď sa predloha nemení" },
    figure: { type: "integer", description: "číslo obrázka z ponuky, ktorý patrí k predlohe; 0 = žiadny" },
  };
  for (const t of types) properties[t] = { type: "array", items: AI_SCHEMA[t], description: `nové cvičenia typu ${t}` };

  const prompt = [
    `Lekcia: ${str(body?.title, 160)}`,
    "",
    sections.map((s, i) => `--- Časť ${i + 1}: ${s.heading}\n${s.text}`).join("\n\n"),
    "",
    "--- Predloha (cvičenie, ktorého sa pokyn týka)",
    `Kód: ${str(target.code, 10)}`,
    `Typ: ${targetType}`,
    `Téma: ${str(target.concept, 80)}`,
    `Zadanie: ${str(target.text, 400)}`,
    `Správna odpoveď: ${str(target.solution, 400)}`,
    "",
    JSON.stringify(target.payload ?? {}).slice(0, 2000),
    refs.length
      ? `\n--- Cvičenia, na ktoré sa pokyn odvoláva kódom\n${refs
          .map((r) => `${str(r.code, 10)} (${str(r.type, 20)}): ${str(r.text, 240)} → ${str(r.solution, 240)}`)
          .join("\n")}`
      : "",
    figures.length ? `\n--- Obrázky v galérii lekcie\n${figures.map((f, i) => `${i + 1}. ${f.caption || "bez popisu"} — ${f.explain}`).join("\n")}` : "",
    "",
    `--- Pokyn rodiča: ${action.label}`,
    instruction ? `Vlastnými slovami: ${instruction}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const raw = await structured<Record<string, unknown>>({
      system: system(String(body?.subject ?? ""), grade, action.rule, types, count),
      prompt,
      toolName: "save_revision",
      description: "Save the revised and newly created exercises",
      schema: { type: "object", properties, required: ["note"] },
      maxTokens: Math.max(12000, count * 900),
    });

    const added: Revised[] = [];
    for (const { key } of TYPES) {
      if (!types.includes(key)) continue;
      for (const item of Array.isArray(raw[key]) ? (raw[key] as Record<string, unknown>[]) : []) {
        if (added.length >= count) break;
        const payload = cleanPayload(key, item);
        if (!payload) continue;
        const level = Number(item.level);
        added.push({ type: key, payload, concept: str(item.concept, 80), level: level >= 1 && level <= 3 ? level : 1 });
      }
    }

    const fixedPayload = raw.fixed ? cleanPayload(targetType, raw.fixed) : null;
    const fi = Number(raw.figure);
    const figure = Number.isInteger(fi) && fi >= 1 && fi <= figures.length ? figures[fi - 1].id : null;

    return Response.json({
      note: str(raw.note, 300) || "Hotovo.",
      fixed: fixedPayload ? { payload: fixedPayload, concept: str((raw.fixed as Record<string, unknown>).concept, 80) } : null,
      added,
      figure,
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "AI zlyhala." }, { status: 502 });
  }
}
