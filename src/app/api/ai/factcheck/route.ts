import { GRADES, subjectDef } from "@/data/subjects";
import { aiConfigured, NOT_CONFIGURED, structured } from "@/lib/openai";
import { requireUser, unauthorized } from "@/lib/server-auth";

export const maxDuration = 300;

type Section = { heading?: string; text?: string };
type Item = { id?: string; text?: string };
type In = { subject?: string; grade?: number | null; title?: string; sections?: Section[]; items?: Item[] };

export type Verdict = { id: string; ok: boolean; note: string };
type Raw = { results?: unknown };

const SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      description: "jeden výsledok pre každé cvičenie, ktoré si dostal",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "id cvičenia tak, ako prišlo na vstupe" },
          ok: { type: "boolean", description: "true, keď je cvičenie v poriadku" },
          note: { type: "string", description: "keď ok=false, jednou vetou čo mu vadí; inak prázdne" },
        },
        required: ["id", "ok", "note"],
      },
    },
  },
  required: ["results"],
};

const system = (subject: string, grade: number | null) => {
  const def = subjectDef(subject);
  return `Kontroluješ cvičenia, ktoré iný model vyrobil z prepisu učebnice ${def?.name ?? subject} pre žiaka ${grade ? `${grade}. ročníka ` : ""}základnej školy.

Dostaneš prepis učiva a zoznam cvičení aj s ich správnymi odpoveďami. Pri každom cvičení rozhodni, či je v poriadku.

Cvičenie NIE JE v poriadku, keď:
- označená správna odpoveď je vecne nesprávna alebo nesedí s prepisom,
- otázka sa pýta na niečo, čo v prepise nie je, takže sa to z učiva nedá vedieť,
- správnych odpovedí je v skutočnosti viac a označená je len jedna, alebo naopak,
- otázka je dvojzmyselná a dá sa pochopiť viacerými spôsobmi,
- niektorá nesprávna možnosť je v skutočnosti tiež správna,
- je v ňom pravopisná alebo gramatická chyba, ktorá mení význam,
- je neprimeraná veku alebo obsahuje nevhodnú tému.

Drobné štylistické výhrady nie sú dôvod na zamietnutie. Zamietaj len vtedy, keď by sa dieťa naučilo niečo zle alebo by nevedelo odpovedať.

Pri ok=false napíš do "note" jednou vetou po slovensky, čo konkrétne je zle, nech to rodič vie opraviť. Pri ok=true nechaj "note" prázdne.

Odpovedz pre každé cvičenie, ktoré si dostal, a použi presne to isté id.`;
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
  const items = (body?.items ?? [])
    .map((i) => ({ id: String(i.id ?? ""), text: String(i.text ?? "") }))
    .filter((i) => i.id && i.text)
    .slice(0, 40);
  if (!sections.length) return Response.json({ error: "Lekcia nemá prepísaný materiál." }, { status: 400 });
  if (!items.length) return Response.json({ error: "Nie je čo kontrolovať." }, { status: 400 });
  const grade = GRADES.includes(Number(body?.grade)) ? Number(body?.grade) : null;

  try {
    const raw = await structured<Raw>({
      system: system(String(body?.subject ?? ""), grade),
      prompt: `Lekcia: ${String(body?.title ?? "").slice(0, 160)}

=== PREPIS UČIVA ===
${sections.map((s, i) => `--- Časť ${i + 1}: ${s.heading}\n${s.text}`).join("\n\n")}

=== CVIČENIA NA KONTROLU ===
${items.map((i) => `[${i.id}]\n${i.text}`).join("\n\n")}`,
      toolName: "save_check",
      description: "Save the review verdicts",
      schema: SCHEMA,
      maxTokens: Math.max(8000, items.length * 400),
    });

    const known = new Set(items.map((i) => i.id));
    const seen = new Set<string>();
    const results: Verdict[] = [];
    for (const r of Array.isArray(raw.results) ? raw.results : []) {
      const o = (r ?? {}) as Record<string, unknown>;
      const id = String(o.id ?? "");
      if (!known.has(id) || seen.has(id)) continue;
      seen.add(id);
      const ok = o.ok === true;
      results.push({
        id,
        ok,
        note: ok
          ? ""
          : String(o.note ?? "")
              .trim()
              .replace(/\s+/g, " ")
              .slice(0, 300) || "AI označila cvičenie za chybné, dôvod neuviedla.",
      });
    }
    // na čo AI neodpovedala, ostáva neskontrolované — radšej než ticho prejsť
    return Response.json({ results, missing: items.filter((i) => !seen.has(i.id)).map((i) => i.id) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "AI zlyhala." }, { status: 502 });
  }
}
