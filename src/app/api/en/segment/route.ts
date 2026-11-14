import { aiConfigured, NOT_CONFIGURED, arr, gradeNote, s, structured } from "@/lib/en/llm";
import { requireUser, unauthorized } from "@/lib/server-auth";
import { cleanTypes } from "@/lib/en/sources";

export const maxDuration = 120;

type Raw = {
  title?: unknown;
  unit?: unknown;
  exercises?: { label?: unknown; instruction?: unknown; text?: unknown; note?: unknown; suggested?: unknown }[];
};

const SYSTEM = (
  grade?: number | null,
) => `You help a Slovak parent turn photographed pages of an English textbook for children (for example Headway) into practice for a learning app.
${gradeNote(grade)}

Split the page into its individual exercises and boxes, in reading order. For each one return:
- label: the exercise number or name exactly as printed (e.g. "3", "4b", "Vocabulary", "Grammar spot"). If nothing is printed, a short English description such as "Word box".
- instruction: the instruction line exactly as printed, in English. Empty string if there is none.
- text: a faithful transcription of the exercise content. Keep line breaks, numbering, word lists, speaker names and example answers. Write every gap as ___. If the exercise depends on pictures, describe each relevant picture briefly in Slovak in square brackets, e.g. [obrázok: pes v búde]. Do not solve the exercise, do not translate, do not add anything that is not printed.
- note: one short sentence in Slovak saying what the child does in this exercise.
- suggested: which practice types of the app fit, chosen from: vocab, grammar, reading, listening, writing, skip.
  vocab = word lists, vocabulary boxes, matching words to pictures or meanings.
  grammar = gap-fills, choosing the correct form, grammar boxes with example sentences.
  reading = reading texts, dialogues and stories whose full text is printed.
  listening = texts or sentences to listen to and repeat, but only when their full text is printed on the page.
  writing = putting words in the right order, completing or writing short sentences with one clear correct answer.
  skip = listening tasks whose audio script is not printed, speaking or pair work, games, drawing, personal answers (write about you), projects and anything the app cannot check.
  Usually choose one or two types. Use skip alone, never together with another type.

Leave out page headers, page numbers, footers and decorative text.
If the page shows a unit or lesson heading, return it as title (and the unit number as unit).`;

export async function POST(req: Request) {
  if (!aiConfigured()) return Response.json({ error: NOT_CONFIGURED }, { status: 503 });
  const user = await requireUser(req);
  if (!user) return unauthorized();

  const body = (await req.json().catch(() => null)) as { image?: string; mediaType?: string; grade?: number | null } | null;
  if (!body?.image) return Response.json({ error: "Chýba obrázok." }, { status: 400 });
  const mediaType = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(body.mediaType ?? "") ? body.mediaType! : "image/jpeg";

  try {
    const raw = await structured<Raw>({
      system: SYSTEM(body.grade),
      toolName: "save_page_exercises",
      description: "Save the exercises found on the textbook page",
      maxTokens: 12000,
      schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          unit: { type: "string" },
          exercises: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                instruction: { type: "string" },
                text: { type: "string" },
                note: { type: "string" },
                suggested: { type: "array", items: { type: "string", enum: ["vocab", "grammar", "reading", "listening", "writing", "skip"] } },
              },
              required: ["label", "instruction", "text", "note", "suggested"],
            },
          },
        },
        required: ["exercises"],
      },
      content: [
        { type: "image", mediaType, data: body.image },
        { type: "text", text: "Split this textbook page into exercises." },
      ],
    });
    const exercises = arr<NonNullable<Raw["exercises"]>[number]>(raw.exercises)
      .map((e) => ({
        label: s(e.label, 80),
        instruction: s(e.instruction, 600),
        text: s(e.text, 8000),
        note: s(e.note, 300),
        suggested: cleanTypes(arr<string>(e.suggested)),
      }))
      .filter((e) => e.text || e.instruction);
    return Response.json({ title: s(raw.title, 120), unit: s(raw.unit, 40), exercises });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "AI zlyhala." }, { status: 502 });
  }
}
