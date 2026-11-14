import { aiConfigured, aiStatus, NOT_CONFIGURED, grammarSchema, gradeNote, sentenceSchema, structured, STYLE, vocabSchema } from "@/lib/en/llm";
import { requireUser, unauthorized } from "@/lib/server-auth";

export const maxDuration = 90;

export async function GET(req: Request) {
  void req.headers.get("authorization");
  return Response.json(aiStatus());
}

type Body =
  | { mode: "vocab"; items: { en: string; sk: string; example_en?: string; example_sk?: string; emoji?: string }[]; grade?: number | null }
  | { mode: "grammar"; topic: string; words?: string[]; count?: number; grade?: number | null }
  | { mode: "translate"; sentences: string[] };

export async function POST(req: Request) {
  if (!aiConfigured()) return Response.json({ error: NOT_CONFIGURED }, { status: 503 });
  const user = await requireUser(req);
  if (!user) return unauthorized();
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return Response.json({ error: "Chýbajú dáta." }, { status: 400 });

  try {
    if (body.mode === "vocab") {
      const items = (body.items ?? []).slice(0, 80);
      const r = await structured<{ items: unknown[] }>({
        system: `You prepare English vocabulary practice for a Slovak child. ${gradeNote(body.grade)}\n${STYLE}\nKeep "en" and "sk" exactly as given. Keep any example or emoji that is already filled in; fill in only the missing ones.`,
        toolName: "save_items",
        description: "Save the completed vocabulary items",
        schema: { type: "object", properties: { items: { type: "array", items: vocabSchema } }, required: ["items"] },
        content: [{ type: "text", text: `Complete these items:\n${JSON.stringify(items)}` }],
      });
      return Response.json({ items: r.items ?? [] });
    }

    if (body.mode === "grammar") {
      const count = Math.min(Math.max(body.count ?? 8, 3), 15);
      const r = await structured<{ items: unknown[] }>({
        system: `You write grammar gap-fill exercises for a Slovak child learning English. ${gradeNote(body.grade)}\n${STYLE}\nEach sentence has exactly one gap ___ that tests the grammar topic. Vary the sentences. Options must be plausible mistakes a child makes.`,
        toolName: "save_exercises",
        description: "Save the grammar exercises",
        schema: { type: "object", properties: { items: { type: "array", items: grammarSchema } }, required: ["items"] },
        content: [
          {
            type: "text",
            text: `Topic: ${body.topic}\nWrite ${count} exercises.${body.words?.length ? ` Where it fits, use words from this lesson: ${body.words.slice(0, 60).join(", ")}.` : ""}`,
          },
        ],
      });
      return Response.json({ items: r.items ?? [] });
    }

    if (body.mode === "translate") {
      const sentences = (body.sentences ?? []).slice(0, 80);
      const r = await structured<{ sentences: { en: string; sk: string }[] }>({
        system: `You translate English sentences from a children's textbook into Slovak. ${STYLE}\nKeep the English exactly as given and in the same order.`,
        toolName: "save_translation",
        description: "Save the translated sentences",
        schema: { type: "object", properties: { sentences: { type: "array", items: sentenceSchema } }, required: ["sentences"] },
        content: [{ type: "text", text: JSON.stringify(sentences) }],
      });
      return Response.json({ sentences: r.sentences ?? [] });
    }

    return Response.json({ error: "Neznámy režim." }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "AI zlyhala." }, { status: 502 });
  }
}
