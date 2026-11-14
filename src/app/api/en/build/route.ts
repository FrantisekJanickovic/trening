import { aiConfigured, NOT_CONFIGURED, arr, grammarSchema, gradeNote, s, sentenceSchema, structured, STYLE, vocabSchema } from "@/lib/en/llm";
import { requireUser, unauthorized } from "@/lib/server-auth";
import { cleanTypes, effective } from "@/lib/en/sources";

export const maxDuration = 90;

type Body = { label?: string; instruction?: string; content?: string; types?: string[]; grade?: number | null; note?: string };
type Pair = { en?: unknown; sk?: unknown };

const RULES: Record<string, string> = {
  vocab: `vocab: the English words and short phrases this exercise teaches or practises, each with a Slovak translation, a short example sentence (max 8 words) with translation, and one emoji. For a word list include every word. Leave out function words such as a, the, and, is.`,
  grammar: `grammar: turn each item of the exercise into a gap-fill: one English sentence with exactly one ___ gap where the practised word or words go, the correct answer (acceptable alternatives separated by |), 3-4 options including the answer, the Slovak translation of the complete sentence and one short Slovak explanation of the rule. If the exercise has a different format (choose the correct word, correct the mistake, grammar box), create equivalent gap-fills from its sentences. Work out the correct answers yourself.`,
  text: `text: the reading or listening text of the exercise (text, dialogue, story or sentences to repeat), split into sentences, each with a natural Slovak translation. Keep speaker names in dialogues, e.g. "Tom: Hello!". Add a short title.`,
  writing: `writing: complete, correct English sentences a child can build from words: the target sentences of the exercise (e.g. the correctly ordered or completed sentences). Each 3-12 words, with Slovak translation. Use only sentences with one clear correct word order.`,
};

export async function POST(req: Request) {
  if (!aiConfigured()) return Response.json({ error: NOT_CONFIGURED }, { status: 503 });
  const user = await requireUser(req);
  if (!user) return unauthorized();

  const body = (await req.json().catch(() => null)) as Body | null;
  const types = effective(cleanTypes(body?.types));
  const content = s(body?.content, 8000);
  if (!content || !types.length) return Response.json({ error: "Chýba text cvičenia alebo typ." }, { status: 400 });

  const wantText = types.includes("reading") || types.includes("listening");
  const keys = [types.includes("vocab") && "vocab", types.includes("grammar") && "grammar", wantText && "text", types.includes("writing") && "writing"].filter(
    Boolean,
  ) as string[];

  const properties: Record<string, unknown> = {};
  if (keys.includes("vocab")) properties.vocab = { type: "array", items: vocabSchema };
  if (keys.includes("grammar")) properties.grammar = { type: "array", items: grammarSchema };
  if (keys.includes("text"))
    properties.text = {
      type: "object",
      properties: { title: { type: "string" }, sentences: { type: "array", items: sentenceSchema } },
      required: ["title", "sentences"],
    };
  if (keys.includes("writing")) properties.writing = { type: "array", items: sentenceSchema };

  const system = `You turn one exercise from an English textbook for Slovak primary-school children into practice items for a learning app.
${gradeNote(body?.grade)}
${STYLE}
Use only the content of this exercise; do not invent unrelated material. Square brackets describe pictures on the page.
Return these parts:
${keys.map((k) => `- ${RULES[k]}`).join("\n")}${
    s(body?.note, 200) ? `\n\nThe parent asked for this, follow it as long as it does not break the rules above:\n${s(body?.note, 200)}` : ""
  }`;

  try {
    const raw = await structured<{ vocab?: unknown; grammar?: unknown; text?: { title?: unknown; sentences?: unknown }; writing?: unknown }>({
      system,
      toolName: "save_practice_items",
      description: "Save the practice items for this exercise",
      maxTokens: 8000,
      schema: { type: "object", properties, required: keys },
      content: [
        {
          type: "text",
          text: `Exercise ${s(body?.label, 80) || ""}\nInstruction: ${s(body?.instruction, 600) || "(none)"}\n\n${content}`,
        },
      ],
    });

    const pairs = (v: unknown) =>
      arr<Pair>(v)
        .map((p) => ({ en: s(p.en, 400), sk: s(p.sk, 400) }))
        .filter((p) => p.en);

    return Response.json({
      vocab: arr<Record<string, unknown>>(raw.vocab)
        .map((v) => ({ en: s(v.en, 120), sk: s(v.sk, 200), example_en: s(v.example_en, 200), example_sk: s(v.example_sk, 200), emoji: s(v.emoji, 16) }))
        .filter((v) => v.en && v.sk),
      grammar: arr<Record<string, unknown>>(raw.grammar)
        .map((g) => ({
          prompt: s(g.prompt, 300),
          answer: s(g.answer, 120),
          options: arr<unknown>(g.options)
            .map((o) => s(o, 80))
            .filter(Boolean)
            .slice(0, 5),
          translation_sk: s(g.translation_sk, 300),
          explanation_sk: s(g.explanation_sk, 300),
        }))
        .filter((g) => /_{2,}/.test(g.prompt) && g.answer),
      text: raw.text ? { title: s(raw.text.title, 120), sentences: pairs(raw.text.sentences) } : null,
      writing: pairs(raw.writing).filter((p) => p.en.split(/\s+/).length >= 2),
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "AI zlyhala." }, { status: 502 });
  }
}
