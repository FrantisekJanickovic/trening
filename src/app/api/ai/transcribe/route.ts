import { GRADES, subjectDef } from "@/data/subjects";
import { aiConfigured, aiModel, NOT_CONFIGURED, structured, type Part } from "@/lib/openai";
import { requireUser, unauthorized } from "@/lib/server-auth";

export const maxDuration = 300;

export async function GET(req: Request) {
  void req.headers.get("authorization");
  return Response.json({ ai: aiConfigured(), model: aiConfigured() ? aiModel() : null });
}

type Raw = { title?: unknown; sections?: { heading?: unknown; text?: unknown }[]; figures?: unknown; rotation?: unknown };

/** Obrázok nájdený na strane: kde je, čo k nemu píše kniha a vysvetlenie navyše. */
export type FigureOut = { box: [number, number, number, number]; caption: string; explain: string };

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
    rotation: {
      type: "integer",
      description: "o koľko stupňov v smere hodinových ručičiek treba stranu otočiť, aby bol text rovno: 0, 90, 180 alebo 270",
    },
    figures: {
      type: "array",
      description: "obrázky, mapy, schémy a tabuľky na strane; prázdne, keď tam žiadne nie sú",
      items: {
        type: "object",
        properties: {
          box: {
            type: "array",
            description: "orámovanie obrázka ako [vľavo, hore, vpravo, dole] v podieloch šírky a výšky strany, od 0 po 1",
            items: { type: "number" },
          },
          caption: { type: "string", description: "popis spod obrázka tak, ako je vytlačený; prázdne, keď tam nie je" },
          explain: { type: "string", description: "vlastné dovysvetlenie, čo je na obrázku vidieť a prečo je dôležitý" },
        },
        required: ["box", "caption", "explain"],
      },
    },
  },
  required: ["title", "sections", "figures", "rotation"],
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

Strana môže byť odfotená otočená, aj hore nohami. Prečítaj ju aj tak a do "rotation" napíš, o koľko stupňov v smere hodinových ručičiek ju treba otočiť, aby bol text rovno: 0, 90, 180 alebo 270. Keď je rovno, napíš 0.

Okrem textu nájdi na strane obrázky, mapy, schémy a tabuľky a pre každý vráť položku vo "figures":
- "box" je orámovanie obrázka v podieloch strany: [vľavo, hore, vpravo, dole], kde 0 je ľavý horný roh a 1 pravý dolný. Rámuj celý obrázok aj s popisom pod ním, radšej o kúsok širšie než tesne.
- "caption" je popis spod obrázka presne tak, ako je vytlačený. Keď tam popis nie je, nechaj prázdne.
- "explain" je tvoje vlastné dovysvetlenie v dvoch až troch vetách: čo je na obrázku vidieť a prečo je dôležitý. Píš ho jednoduchšie, ako je zvyšok strany${grade && grade > 1 ? `, zrozumiteľne pre dieťa z ${grade - 1}. ročníka` : ""} — dieťa si ho číta samo, keď textu nerozumie.
- Ozdobné rámčeky, logá a fotky bez výpovednej hodnoty vynechaj.
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

    // Súradnice od modelu bývajú občas mimo; čo sa nedá orezať, radšej zahodíme,
    // než by sme do galérie dali výrez cez pol strany alebo prázdny prúžok.
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : NaN);
    const figures: FigureOut[] = [];
    for (const f of Array.isArray(raw.figures) ? raw.figures : []) {
      if (figures.length >= 8) break;
      const o = (f ?? {}) as { box?: unknown; caption?: unknown; explain?: unknown };
      const b = (Array.isArray(o.box) ? o.box : []).map(num);
      if (b.length !== 4 || b.some(Number.isNaN)) continue;
      const [x0, y0, x1, y1] = [Math.min(b[0], b[2]), Math.min(b[1], b[3]), Math.max(b[0], b[2]), Math.max(b[1], b[3])];
      if (x1 - x0 < 0.08 || y1 - y0 < 0.06) continue;
      figures.push({
        box: [x0, y0, x1, y1],
        caption: String(o.caption ?? "").trim().slice(0, 400),
        explain: String(o.explain ?? "").trim().slice(0, 700),
      });
    }

    const rot = Number(raw.rotation);
    const rotation = [0, 90, 180, 270].includes(rot) ? rot : 0;

    return Response.json({
      rotation,
      title: String(raw.title ?? "")
        .trim()
        .slice(0, 160),
      sections,
      figures,
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "AI zlyhala." }, { status: 502 });
  }
}
