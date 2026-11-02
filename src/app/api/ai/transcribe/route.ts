import { GRADES, subjectDef } from "@/data/subjects";
import { aiConfigured, aiModel, NOT_CONFIGURED, structured, type Part } from "@/lib/openai";
import { requireUser, unauthorized } from "@/lib/server-auth";

export const maxDuration = 300;

export async function GET(req: Request) {
  void req.headers.get("authorization");
  return Response.json({ ai: aiConfigured(), model: aiConfigured() ? aiModel() : null });
}

type Raw = { title?: unknown; sections?: { heading?: unknown; text?: unknown }[] };

const SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "názov lekcie podľa nadpisu na strane" },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          heading: { type: "string", description: "nadpis časti, alebo krátke pomenovanie" },
          text: { type: "string", description: "prepis textu tejto časti" },
        },
        required: ["heading", "text"],
      },
    },
  },
  required: ["title", "sections"],
};

const system = (subject: string, grade: number | null) => {
  const def = subjectDef(subject);
  return `Prepisuješ stranu učebnice ${def?.name ?? subject} pre žiaka ${grade ? `${grade}. ročníka ` : ""}základnej školy na Slovensku.

Prepíš obsah strany po častiach, v poradí, v akom je na strane:
- heading: nadpis časti tak, ako je vytlačený. Ak nadpis nie je, napíš krátke pomenovanie v slovenčine.
- text: verný prepis textu tejto časti vrátane letopočtov, mien a čísel. Zachovaj odrážky ako nové riadky.

Pravidlá:
- Neprekladaj a nevysvetľuj, len prepisuj. Nevymýšľaj nič, čo na strane nie je.
- Popisky obrázkov a máp prepíš tiež, do vlastnej časti, a pred text dopíš „Obrázok: “.
- Vynechaj čísla strán, hlavičky, pätky a otázky na opakovanie bez odpovedí.
- Ak je strana nečitateľná, vráť prázdny zoznam častí.
${def ? `\nNa čo si dať pozor v tomto predmete: ${def.hint}` : ""}`;
};

export async function POST(req: Request) {
  if (!aiConfigured()) return Response.json({ error: NOT_CONFIGURED }, { status: 503 });
  const user = await requireUser(req);
  if (!user) return unauthorized();
  const body = (await req.json().catch(() => null)) as { image?: string; mediaType?: string; subject?: string; grade?: number | null } | null;
  if (!body?.image) return Response.json({ error: "Chýba obrázok." }, { status: 400 });
  const mediaType = ["image/jpeg", "image/png", "image/webp"].includes(body.mediaType ?? "") ? body.mediaType! : "image/jpeg";
  const grade = GRADES.includes(Number(body.grade)) ? Number(body.grade) : null;

  try {
    const prompt: Part[] = [
      { type: "image", mediaType, data: body.image },
      { type: "text", text: "Prepíš túto stranu učebnice po častiach." },
    ];
    const raw = await structured<Raw>({
      system: system(String(body.subject ?? ""), grade),
      prompt,
      toolName: "save_page",
      description: "Save the transcript of the page",
      schema: SCHEMA,
      maxTokens: 16000,
    });
    const sections = (Array.isArray(raw.sections) ? raw.sections : [])
      .map((s) => ({
        heading: String(s?.heading ?? "")
          .trim()
          .slice(0, 160),
        text: String(s?.text ?? "")
          .trim()
          .slice(0, 8000),
      }))
      .filter((s) => s.text);
    return Response.json({
      title: String(raw.title ?? "")
        .trim()
        .slice(0, 160),
      sections,
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "AI zlyhala." }, { status: 502 });
  }
}
