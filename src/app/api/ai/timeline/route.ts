import { GRADES, subjectDef } from "@/data/subjects";
import { aiConfigured, NOT_CONFIGURED, structured } from "@/lib/openai";
import { requireUser, unauthorized } from "@/lib/server-auth";
import type { TimelineData, TimelineEvent } from "@/lib/timeline";

export const maxDuration = 300;

type Section = { heading?: string; text?: string };
type In = { subject?: string; grade?: number | null; title?: string; scope?: string; sections?: Section[]; prompt?: string };
type Raw = { title?: unknown; events?: unknown };

const SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "nadpis osi, 2 až 5 slov" },
    events: {
      type: "array",
      description: "udalosti v poradí, ako nasledovali, 4 až 12 kusov",
      items: {
        type: "object",
        properties: {
          year: { type: "string", description: "rok tak, ako je v učebnici: 833, okolo 907, 9. storočie" },
          title: { type: "string", description: "čo sa stalo, najviac 6 slov" },
          text: { type: "string", description: "jedna krátka veta, prečo je to dôležité" },
          link: { type: "string", description: "nepovinné, 2 až 4 slová o tom, čo túto udalosť spája s predošlou" },
          icon: { type: "string", description: "jedno emoji, ktoré udalosť vystihuje" },
        },
        required: ["year", "title", "text"],
      },
    },
  },
  required: ["title", "events"],
};

const system = (subject: string, grade: number | null, scope: string, extra: string) => {
  const def = subjectDef(subject);
  return `Robíš časovú os na učenie pre žiaka ${grade ? `${grade}. ročníka ` : ""}základnej školy na Slovensku, predmet ${def?.name ?? subject}.

Dostaneš prepis učiva (${scope}). Os rob IBA z toho, čo je v prepise. Nič si nevymýšľaj a žiadny rok nedopĺňaj z vlastných vedomostí.

Ako má os vyzerať:
- Vyber 4 až 12 udalostí, ktoré majú v texte rok alebo obdobie. Zoraď ich od najstaršej po najnovšiu.
- "year" opíš presne tak, ako je v učebnici. Keď je obdobie neisté, napíš to rovnako neisto, napríklad „okolo 907“.
- "title" je, čo sa stalo, najviac 6 slov, bez bodky.
- "text" je jedna krátka veta, prečo je udalosť dôležitá. Píš pre dieťa, jednoducho.
- "link" je nepovinné: 2 až 4 slová, čo túto udalosť spája s predošlou, napríklad „jeho syn“, „o 30 rokov neskôr“, „preto prišli“. Daj ho len tam, kde súvislosť naozaj z textu vyplýva.
- "icon" je jedno emoji, ktoré udalosť vystihuje. Vyberaj pokojné a vecné, žiadne zbrane ani násilie.
- Ak v prepise nie sú aspoň štyri udalosti s rokom, vráť prázdny zoznam udalostí.

Slovenčina s diakritikou, slovná zásoba primeraná veku.${def ? `\n\nNa čo si dať pozor v tomto predmete: ${def.hint}` : ""}${extra ? `\n\nRodič k tejto osi pridal pokyn, riaď sa ním: ${extra}` : ""}`;
};

const str = (v: unknown, max: number) =>
  String(v ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);

/** Jedno emoji, nič iné — do karty sa viac nezmestí a text by ju rozbil. */
const oneEmoji = (v: unknown) => {
  const s = str(v, 8);
  const chars = [...s].filter((c) => /\p{Extended_Pictographic}/u.test(c));
  return chars.length ? chars[0] : undefined;
};

function clean(raw: Raw): TimelineData | null {
  const title = str(raw.title, 60);
  const events: TimelineEvent[] = [];
  for (const e of Array.isArray(raw.events) ? raw.events : []) {
    if (events.length >= 12) break;
    const o = (e ?? {}) as Record<string, unknown>;
    const year = str(o.year, 24);
    const t = str(o.title, 60);
    if (!year || !t) continue;
    events.push({
      year,
      title: t,
      text: str(o.text, 130) || undefined,
      link: str(o.link, 28) || undefined,
      icon: oneEmoji(o.icon),
    });
  }
  return events.length >= 3 ? { title: title || "Časová os", events } : null;
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

  try {
    const raw = await structured<Raw>({
      system: system(String(body?.subject ?? ""), grade, str(body?.scope, 60) || "celá kapitola", str(body?.prompt, 600)),
      prompt: `Lekcia: ${str(body?.title, 160)}\n\n${sections.map((s, i) => `--- Časť ${i + 1}: ${s.heading}\n${s.text}`).join("\n\n")}`,
      toolName: "save_timeline",
      description: "Save the timeline",
      schema: SCHEMA,
      maxTokens: 12000,
    });
    const line = clean(raw);
    if (!line) return Response.json({ error: "V tejto lekcii nie je dosť udalostí s letopočtami na časovú os." }, { status: 422 });
    return Response.json({ timeline: line });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "AI zlyhala." }, { status: 502 });
  }
}
