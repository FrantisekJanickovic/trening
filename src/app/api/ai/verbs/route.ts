import { aiConfigured, NOT_CONFIGURED, structured, type Part } from "@/lib/openai";
import { requireUser, unauthorized } from "@/lib/server-auth";

export const maxDuration = 300;

type Raw = { verbs?: unknown; rotation?: unknown };
export type VerbOut = { base: string; past: string; participle: string; sk: string };

const SCHEMA = {
  type: "object",
  properties: {
    rotation: { type: "integer", description: "o koľko stupňov v smere hodinových ručičiek treba stranu otočiť, aby bol text rovno: 0, 90, 180 alebo 270" },
    verbs: {
      type: "array",
      description: "slovesá v poradí, v akom sú na strane",
      items: {
        type: "object",
        properties: {
          base: { type: "string", description: "základný tvar, napríklad go" },
          past: { type: "string", description: "minulý čas, napríklad went" },
          participle: { type: "string", description: "minulé príčastie, napríklad gone" },
          sk: { type: "string", description: "slovenský význam, napríklad ísť" },
        },
        required: ["base", "past", "participle", "sk"],
      },
    },
  },
  required: ["verbs", "rotation"],
};

const SYSTEM = `Z nafotenej strany prepisuješ tabuľku anglických nepravidelných slovies pre žiaka základnej školy na Slovensku.

Pre každé sloveso vráť štyri hodnoty: základný tvar, minulý čas, minulé príčastie a slovenský význam.

Pravidlá:
- Prepisuj presne to, čo je na strane. Slovesá si nedopĺňaj z vlastných vedomostí a žiadne nevynechávaj.
- Zachovaj poradie zo strany, zhora nadol.
- Keď má tvar dve podoby, napíš ich s lomkou: learned/learnt.
- Pri základnom tvare vynechaj „to“, píš go, nie to go.
- Slovenský význam napíš tak, ako je v tabuľke. Keď je ich viac, oddeľ ich čiarkou.
- Keď niektorý údaj na strane chýba, nechaj preň prázdny reťazec.
- Riadky, ktoré nie sú slovesá (nadpisy, čísla strán, poznámky), vynechaj.

Strana môže byť odfotená otočená, aj hore nohami. Prečítaj ju aj tak a do "rotation" napíš, o koľko stupňov v smere hodinových ručičiek ju treba otočiť, aby bol text rovno.`;

const str = (v: unknown, max: number) =>
  String(v ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);

export async function POST(req: Request) {
  if (!aiConfigured()) return Response.json({ error: NOT_CONFIGURED }, { status: 503 });
  const user = await requireUser(req);
  if (!user) return unauthorized();
  const body = (await req.json().catch(() => null)) as { image?: string; mediaType?: string } | null;
  if (!body?.image) return Response.json({ error: "Chýba obrázok." }, { status: 400 });
  const mediaType = ["image/jpeg", "image/png", "image/webp"].includes(body.mediaType ?? "") ? body.mediaType! : "image/jpeg";

  try {
    const prompt: Part[] = [
      { type: "image", mediaType, data: body.image },
      { type: "text", text: "Prepíš slovesá z tejto strany." },
    ];
    const raw = await structured<Raw>({ system: SYSTEM, prompt, toolName: "save_verbs", description: "Save the irregular verbs", schema: SCHEMA, maxTokens: 16000 });

    const verbs: VerbOut[] = [];
    for (const v of Array.isArray(raw.verbs) ? raw.verbs : []) {
      if (verbs.length >= 120) break;
      const o = (v ?? {}) as Record<string, unknown>;
      const base = str(o.base, 80).replace(/^to\s+/i, "");
      if (!base) continue;
      verbs.push({ base, past: str(o.past, 80), participle: str(o.participle, 80), sk: str(o.sk, 120) });
    }
    const rot = Number(raw.rotation);
    return Response.json({ verbs, rotation: [0, 90, 180, 270].includes(rot) ? rot : 0 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "AI zlyhala." }, { status: 502 });
  }
}
