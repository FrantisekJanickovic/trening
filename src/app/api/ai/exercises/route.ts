import { GRADES, subjectDef } from "@/data/subjects";
import { AI_SCHEMA, ASPECTS, cleanPayload, isAspect, isType, TYPES, type Aspect, type ExerciseType, type Payload } from "@/lib/exercises";
import { aiConfigured, NOT_CONFIGURED, structured } from "@/lib/openai";
import { requireUser, unauthorized } from "@/lib/server-auth";

export const maxDuration = 300;

type Section = { heading?: string; text?: string };
type In = { subject?: string; grade?: number | null; title?: string; sections?: Section[]; types?: string[]; count?: number; avoid?: string[] };
type RawItem = Record<string, unknown> & { concept?: unknown; level?: unknown; aspect?: unknown; source?: unknown };

export type Generated = { type: ExerciseType; payload: Payload; concept: string; level: number; aspect: Aspect; source: number | null };

/** Koľko cvičení z každého typu, aby ich bolo spolu `count`. */
function quotas(types: ExerciseType[], count: number) {
  const base = Math.floor(count / types.length);
  const extra = count % types.length;
  return types.map((t, i) => [t, base + (i < extra ? 1 : 0)] as const).filter(([, n]) => n > 0);
}

const system = (subject: string, grade: number | null, per: readonly (readonly [ExerciseType, number])[], avoid: string[]) => {
  const def = subjectDef(subject);
  return `Pripravuješ cvičenia pre žiaka ${grade ? `${grade}. ročníka ` : ""}základnej školy na Slovensku z predmetu ${def?.name ?? subject}.

Dostaneš prepis lekcie rozdelený na očíslované časti. Vyrob cvičenia IBA z toho, čo je v prepise. Nič si nevymýšľaj a nepoužívaj vedomosti mimo textu.

Koľko čoho vyrobiť:
${per.map(([t, n]) => `- ${t}: ${n} cvičení`).join("\n")}

Náročnosť rozlož takto: asi 60 % cvičení s odpoveďou priamo v texte (level 1), asi 30 % takých, kde treba spojiť dve informácie (level 2), a asi 10 % záludnejších, kde sa dieťa ľahko pomýli, napríklad podobné letopočty alebo mená (level 3). Vždy musí byť odpoveď jednoznačne odvoditeľná z prepisu.

Pravidlá pre všetky cvičenia:
- Slovenčina s diakritikou, krátke vety, slovná zásoba primeraná veku.
- Nesprávne možnosti musia byť vierohodné a z rovnakej oblasti, nie zjavne nezmyselné.
- Nepoužívaj formulácie ako „podľa textu“ alebo „v učebnici“. Otázka má dávať zmysel aj samostatne.
- "concept" je téma cvičenia v 1 až 3 slovách, podľa nej sa cvičenia zoskupujú.
- "source" je číslo časti prepisu, z ktorej cvičenie vzniklo.
- "aspect" je to, čo si dieťa musí pri tomto cvičení zapamätať. Vyber jednu možnosť:
${ASPECTS.map((a) => `  ${a.key} — ${a.hint}`).join("\n")}
  Ak sa cvičenie pýta na rok alebo dátum, patrí vždy do "roky", aj keď je v ňom aj meno alebo miesto.
- Žiadne násilie, alkohol, politické hodnotenia ani nevhodné témy.
${def ? `\nNa čo si dať pozor v tomto predmete: ${def.hint}` : ""}${
    avoid.length ? `\n\nTieto cvičenia už existujú, vyrob iné:\n${avoid.slice(0, 120).join("\n")}` : ""
  }`;
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
  const types = (body?.types ?? []).filter(isType);
  if (!types.length) return Response.json({ error: "Nie je zapnutý žiadny typ cvičenia." }, { status: 400 });
  const count = Math.min(Math.max(Math.round(Number(body?.count) || 20), 1), 60);
  const grade = GRADES.includes(Number(body?.grade)) ? Number(body?.grade) : null;
  const per = quotas(types, count);
  const avoid = (body?.avoid ?? []).filter((t) => typeof t === "string");

  const properties: Record<string, unknown> = {};
  for (const [t] of per) properties[t] = { type: "array", items: AI_SCHEMA[t] };

  try {
    const raw = await structured<Record<string, RawItem[]>>({
      system: system(String(body?.subject ?? ""), grade, per, avoid),
      prompt: `Lekcia: ${String(body?.title ?? "").slice(0, 160)}\n\n${sections.map((s, i) => `--- Časť ${i + 1}: ${s.heading}\n${s.text}`).join("\n\n")}`,
      toolName: "save_exercises",
      description: "Save the generated exercises",
      schema: { type: "object", properties, required: per.map(([t]) => t) },
      maxTokens: Math.max(16000, count * 900),
    });

    const out: Generated[] = [];
    for (const { key } of TYPES) {
      if (!types.includes(key)) continue;
      for (const item of Array.isArray(raw[key]) ? raw[key] : []) {
        const payload = cleanPayload(key, item);
        if (!payload) continue;
        const srcRaw = Number(item.source);
        const source = Number.isInteger(srcRaw) && srcRaw >= 1 && srcRaw <= sections.length ? srcRaw - 1 : null;
        const level = Number(item.level);
        const aspect: Aspect = isAspect(item.aspect) ? item.aspect : "pojmy";
        out.push({
          type: key,
          payload,
          concept: String(item.concept ?? "")
            .trim()
            .slice(0, 80),
          level: level >= 1 && level <= 3 ? level : 1,
          aspect,
          source,
        });
      }
    }
    if (!out.length) return Response.json({ error: "AI nevrátila použiteľné cvičenia. Skús to znova." }, { status: 502 });
    return Response.json({ exercises: out });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "AI zlyhala." }, { status: 502 });
  }
}
