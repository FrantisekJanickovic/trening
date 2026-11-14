import { aiConfigured, arr, grammarSchema, gradeNote, NOT_CONFIGURED, s, structured, STYLE, vocabSchema } from "@/lib/en/llm";
import { ACTIONS, type ItemKind } from "@/lib/en/revise";
import { requireUser, unauthorized } from "@/lib/server-auth";

export const maxDuration = 120;

type Ref = { code?: string; kind?: string; text?: string };
type Body = {
  kind?: ItemKind;
  action?: string;
  instruction?: string;
  grade?: number | null;
  title?: string;
  topic?: string;
  target?: Record<string, unknown>;
  refs?: Ref[];
  /** čo už v lekcii je — aby AI nevyrobila to isté znova */
  existing?: string[];
  count?: number;
};

const textSchema = {
  type: "object",
  properties: {
    title: { type: "string", description: "Short title of the text" },
    sentences: {
      type: "array",
      items: {
        type: "object",
        properties: { en: { type: "string" }, sk: { type: "string", description: "Slovak translation of the sentence" } },
        required: ["en", "sk"],
      },
    },
  },
  required: ["title", "sentences"],
};

const SCHEMA_OF: Record<ItemKind, object> = { vocab: vocabSchema, grammar: grammarSchema, text: textSchema };
const KIND_NAME: Record<ItemKind, string> = { vocab: "vocabulary item", grammar: "grammar gap-fill exercise", text: "reading text" };

export async function POST(req: Request) {
  if (!aiConfigured()) return Response.json({ error: NOT_CONFIGURED }, { status: 503 });
  const user = await requireUser(req);
  if (!user) return unauthorized();
  const body = (await req.json().catch(() => null)) as Body | null;

  const kind = (["vocab", "grammar", "text"] as ItemKind[]).includes(body?.kind as ItemKind) ? (body!.kind as ItemKind) : null;
  if (!kind) return Response.json({ error: "Chýba položka, ku ktorej sa pokyn vzťahuje." }, { status: 400 });
  const action = ACTIONS[String(body?.action ?? "volny")] ?? ACTIONS.volny;
  if (!action.kinds.includes(kind)) return Response.json({ error: "Tento pokyn sa na túto položku nehodí." }, { status: 400 });

  const instruction = s(body?.instruction, 200);
  const count = Math.min(Math.max(Math.round(Number(body?.count) || 5), 1), 15);
  const refs = (body?.refs ?? []).slice(0, 10);
  const existing = (body?.existing ?? []).slice(0, 120);
  const item = SCHEMA_OF[kind];

  const system = `You help a Slovak parent fine-tune one ${KIND_NAME[kind]} in an English lesson. ${gradeNote(body?.grade)}
${STYLE}

What to do:
${action.rule}

Rules:
- Work only from the item you are given and the parent's instruction. Invent nothing beyond the lesson's topic.
- When you create new items, create at most ${count} and never repeat anything the lesson already has.
- Write "note" as one short sentence in Slovak saying what you did. If the instruction cannot be followed, say so there and create nothing.`;

  const prompt = [
    body?.title ? `Lesson: ${s(body.title, 160)}` : "",
    body?.topic ? `Topic: ${s(body.topic, 160)}` : "",
    "",
    `The item (${KIND_NAME[kind]}):`,
    JSON.stringify(body?.target ?? {}).slice(0, 3000),
    refs.length ? `\nItems the parent refers to by code:\n${refs.map((r) => `${s(r.code, 10)} (${s(r.kind, 12)}): ${s(r.text, 240)}`).join("\n")}` : "",
    existing.length ? `\nAlready in the lesson, do not repeat:\n${existing.map((x) => s(x, 80)).join("; ")}` : "",
    "",
    `Parent's request: ${action.label}`,
    instruction ? `In their own words: ${instruction}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const raw = await structured<Record<string, unknown>>({
      system,
      toolName: "save_revision",
      description: "Save the corrected item and any new items",
      schema: {
        type: "object",
        properties: {
          note: { type: "string", description: "one short sentence in Slovak about what you did" },
          fixed: { ...item, description: "the corrected item; omit when nothing about it changes" },
          items: { type: "array", items: item, description: `new ${KIND_NAME[kind]}s` },
        },
        required: ["note"],
      },
      content: [{ type: "text", text: prompt }],
    });

    return Response.json({
      note: s(raw.note, 300) || "Hotovo.",
      fixed: raw.fixed && typeof raw.fixed === "object" ? raw.fixed : null,
      items: arr<Record<string, unknown>>(raw.items).slice(0, count),
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "AI zlyhala." }, { status: 502 });
  }
}
