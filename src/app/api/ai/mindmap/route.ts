import { GRADES, subjectDef } from "@/data/subjects";
import type { MindBranch, MindItem, MindMapData } from "@/lib/mindmap";
import { aiConfigured, NOT_CONFIGURED, structured } from "@/lib/openai";
import { requireUser, unauthorized } from "@/lib/server-auth";

export const maxDuration = 300;

type Section = { heading?: string; text?: string };
type In = { subject?: string; grade?: number | null; title?: string; scope?: string; sections?: Section[]; prompt?: string };

type Raw = { center?: unknown; branches?: unknown };

const SCHEMA = {
  type: "object",
  properties: {
    center: { type: "string", description: "Stred mapy: téma v 1 až 4 slovách." },
    branches: {
      type: "array",
      description: "Hlavné vetvy mapy, 4 až 7 kusov.",
      items: {
        type: "object",
        properties: {
          label: { type: "string", description: "Názov vetvy, 1 až 3 slová." },
          items: {
            type: "array",
            description: "Body vetvy, 2 až 6 kusov.",
            items: {
              type: "object",
              properties: {
                label: { type: "string", description: "Jeden fakt alebo pojem, najviac 10 slov." },
                items: { type: "array", description: "Nepovinné spresnenie, 0 až 3 krátke body.", items: { type: "string" } },
              },
              required: ["label"],
            },
          },
        },
        required: ["label", "items"],
      },
    },
  },
  required: ["center", "branches"],
};

const system = (subject: string, grade: number | null, scope: string, extra: string) => {
  const def = subjectDef(subject);
  return `Robíš myšlienkovú mapu na učenie pre žiaka ${grade ? `${grade}. ročníka ` : ""}základnej školy na Slovensku, predmet ${def?.name ?? subject}.

Dostaneš prepis učiva (${scope}). Mapu rob IBA z toho, čo je v prepise. Nič si nevymýšľaj.

Mapa má dieťaťu pomôcť zapamätať si látku pohľadom na jednu stranu, nie ju prerozprávať. Preto:
- Stred je téma v 1 až 4 slovách.
- 4 až 7 hlavných vetiev. Vetva je okruh, nie veta — napríklad „Príčiny“, „Panovníci“, „Dôsledky“, „Pojmy“.
- V každej vetve 2 až 6 bodov. Bod je jeden fakt, pojem alebo letopočet, najviac 10 slov, bez celých viet a bez bodky na konci.
- Spresnenie pod bodom používaj len vtedy, keď bez neho bod nedáva zmysel. Najviac 3 a veľmi krátke.
- Zoraď vetvy tak, ako na seba látka nadväzuje: najprv kedy a kde, potom kto, potom čo sa stalo a nakoniec následky a pojmy.
- Čísla, letopočty a mená uveď presne tak, ako sú v prepise — práve tie sa dieťa učí.
- Slovenčina s diakritikou, slovná zásoba primeraná veku.
- Nič sa neopakuje v dvoch vetvách naraz.
${def ? `\nNa čo si dať pozor v tomto predmete: ${def.hint}` : ""}${extra ? `\n\nRodič k tejto mape pridal pokyn, riaď sa ním: ${extra}` : ""}`;
};

const str = (v: unknown, max: number) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max);

/** Z odpovede AI spraví mapu, ktorá sa dá nakresliť: orezané dĺžky, žiadne prázdne vetvy. */
function clean(raw: Raw): MindMapData | null {
  const center = str(raw.center, 60);
  if (!center) return null;

  const branches: MindBranch[] = [];
  for (const b of Array.isArray(raw.branches) ? raw.branches : []) {
    const o = (b ?? {}) as { label?: unknown; items?: unknown };
    const label = str(o.label, 40);
    if (!label) continue;

    const items: MindItem[] = [];
    for (const it of Array.isArray(o.items) ? o.items : []) {
      if (items.length >= 7) break;
      const i = (it ?? {}) as { label?: unknown; items?: unknown };
      const l = str(i.label, 110);
      if (!l) continue;
      const subs = (Array.isArray(i.items) ? i.items : [])
        .map((s) => str(s, 80))
        .filter(Boolean)
        .slice(0, 3);
      items.push(subs.length ? { label: l, items: subs } : { label: l });
    }

    if (items.length) branches.push({ label, items });
    if (branches.length >= 8) break;
  }
  return branches.length >= 2 ? { center, branches } : null;
}

export async function POST(req: Request) {
  if (!aiConfigured()) return Response.json({ error: NOT_CONFIGURED }, { status: 503 });
  const user = await requireUser(req);
  if (!user) return unauthorized();
  const body = (await req.json().catch(() => null)) as In | null;
  const sections = (body?.sections ?? [])
    .map((s) => ({ heading: String(s.heading ?? ""), text: String(s.text ?? "") }))
    .filter((s) => s.text)
    .slice(0, 40);
  if (!sections.length) return Response.json({ error: "Pre vybrané strany nie je prepísaný materiál." }, { status: 400 });
  const grade = GRADES.includes(Number(body?.grade)) ? Number(body?.grade) : null;
  const scope = str(body?.scope, 60) || "celá kapitola";
  const extra = str(body?.prompt, 600);

  try {
    const raw = await structured<Raw>({
      system: system(String(body?.subject ?? ""), grade, scope, extra),
      prompt: `Lekcia: ${str(body?.title, 160)}\n\n${sections.map((s, i) => `--- Časť ${i + 1}: ${s.heading}\n${s.text}`).join("\n\n")}`,
      toolName: "save_mindmap",
      description: "Save the mind map",
      schema: SCHEMA,
      maxTokens: 12000,
    });
    const map = clean(raw);
    if (!map) return Response.json({ error: "AI nevrátila použiteľnú mapu. Skús to znova." }, { status: 502 });
    return Response.json({ map });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "AI zlyhala." }, { status: 502 });
  }
}
