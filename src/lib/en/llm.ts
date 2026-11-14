import Anthropic from "@anthropic-ai/sdk";

export type Provider = "anthropic" | "openai";

/** A piece of the request: text, or a base64 image. */
export type Part = { type: "text"; text: string } | { type: "image"; mediaType: string; data: string };

type JsonSchema = Record<string, unknown>;

type StructuredOpts = {
  system: string;
  content: Part[];
  toolName: string;
  description: string;
  schema: JsonSchema;
  maxTokens?: number;
};

/** Which AI service to use: AI_PROVIDER if set, otherwise whichever key is present (Claude first). */
export function provider(): Provider | null {
  const has = { anthropic: !!process.env.ANTHROPIC_API_KEY, openai: !!process.env.OPENAI_API_KEY };
  const forced = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (forced === "anthropic" || forced === "openai") return has[forced] ? forced : null;
  return has.anthropic ? "anthropic" : has.openai ? "openai" : null;
}

export const aiConfigured = () => provider() !== null;

export const NOT_CONFIGURED = "AI nie je nastavené: vo Verceli chýba kľúč OPENAI_API_KEY alebo ANTHROPIC_API_KEY.";

const model = (p: Provider) => (p === "openai" ? process.env.OPENAI_MODEL || "gpt-6-sol" : process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5");

/** What the parent sees in settings. */
export function aiStatus() {
  const p = provider();
  return { ai: !!p, provider: p, model: p ? model(p) : null };
}

/** Ask the AI for structured output by forcing a single tool (function) call with the given schema. */
export async function structured<T>(opts: StructuredOpts): Promise<T> {
  const p = provider();
  if (!p) throw new Error(NOT_CONFIGURED);
  return p === "openai" ? openai<T>(opts) : claude<T>(opts);
}

async function claude<T>(opts: StructuredOpts): Promise<T> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const content: Anthropic.ContentBlockParam[] = opts.content.map((c) =>
    c.type === "text" ? { type: "text", text: c.text } : { type: "image", source: { type: "base64", media_type: c.mediaType as "image/jpeg", data: c.data } },
  );
  const msg = await client.messages.create({
    model: model("anthropic"),
    max_tokens: opts.maxTokens ?? 8000,
    system: opts.system,
    tools: [{ name: opts.toolName, description: opts.description, input_schema: opts.schema as Anthropic.Tool.InputSchema }],
    tool_choice: { type: "tool", name: opts.toolName },
    messages: [{ role: "user", content }],
  });
  const block = msg.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("AI nevrátila výsledok.");
  return block.input as T;
}

type OpenAIOutput = { type: string; name?: string; arguments?: string };
type OpenAIResponse = { status?: string; output?: OpenAIOutput[]; error?: { message?: string } | null };

function openaiError(status: number, message: string | undefined, m: string) {
  if (status === 401) return "OpenAI odmietlo kľúč OPENAI_API_KEY. Skontroluj, či je vo Verceli skopírovaný celý.";
  if (status === 429) return "OpenAI: prekročený limit alebo došiel kredit na účte (platform.openai.com → Billing).";
  if (status === 404 || /model/i.test(message ?? "")) return `OpenAI: model ${m} nie je dostupný (${message ?? status}). Nastav iný v OPENAI_MODEL.`;
  return `OpenAI: ${message ?? `chyba ${status}`}`;
}

/** OpenAI Responses API with one forced function call. */
async function openai<T>(opts: StructuredOpts): Promise<T> {
  const m = model("openai");
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  // reasoning models think before answering; low effort keeps the import fast
  const reasoning = /^(gpt-5|gpt-6|o\d)/.test(m) ? { reasoning: { effort: process.env.OPENAI_REASONING_EFFORT || "low" } } : {};
  const res = await fetch(`${base}/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: m,
      instructions: opts.system,
      input: [
        {
          role: "user",
          content: opts.content.map((c) =>
            c.type === "text"
              ? { type: "input_text", text: c.text }
              : { type: "input_image", image_url: `data:${c.mediaType};base64,${c.data}`, detail: "high" },
          ),
        },
      ],
      tools: [{ type: "function", name: opts.toolName, description: opts.description, parameters: opts.schema, strict: false }],
      tool_choice: { type: "function", name: opts.toolName },
      max_output_tokens: (opts.maxTokens ?? 8000) * 2,
      store: false,
      ...reasoning,
    }),
  });
  const json = (await res.json().catch(() => null)) as OpenAIResponse | null;
  if (!res.ok) throw new Error(openaiError(res.status, json?.error?.message, m));
  const call = json?.output?.find((o) => o.type === "function_call" && o.name === opts.toolName);
  if (!call?.arguments) {
    if (json?.status === "incomplete") throw new Error("AI nestihla dokončiť odpoveď. Skús to znova alebo s menším množstvom textu.");
    throw new Error("AI nevrátila výsledok.");
  }
  try {
    return JSON.parse(call.arguments) as T;
  } catch {
    throw new Error("AI vrátila neúplný výsledok. Skús to znova.");
  }
}

const str = { type: "string" };

export const vocabSchema = {
  type: "object",
  properties: {
    en: { ...str, description: "English word or phrase" },
    sk: { ...str, description: "Slovak translation; several meanings separated by comma" },
    example_en: { ...str, description: "Short, simple English example sentence using the word (max 8 words)" },
    example_sk: { ...str, description: "Natural Slovak translation of the example sentence" },
    emoji: { ...str, description: "One emoji that depicts the word, or empty string" },
  },
  required: ["en", "sk", "example_en", "example_sk", "emoji"],
};

export const grammarSchema = {
  type: "object",
  properties: {
    prompt: { ...str, description: "English sentence with exactly one gap written as ___" },
    answer: { ...str, description: "Correct word(s) for the gap; acceptable alternatives separated by |" },
    options: { type: "array", items: str, description: "3-4 multiple-choice options including the correct answer" },
    translation_sk: { ...str, description: "Slovak translation of the complete sentence" },
    explanation_sk: { ...str, description: "One short child-friendly explanation of the rule in Slovak" },
  },
  required: ["prompt", "answer", "options", "translation_sk", "explanation_sk"],
};

export const sentenceSchema = {
  type: "object",
  properties: { en: str, sk: str },
  required: ["en", "sk"],
};

export const gradeNote = (grade?: number | null) =>
  grade ? `The child is in grade ${grade} of a Slovak primary school (about ${grade + 5} years old).` : "The child attends a Slovak primary school.";

export const STYLE = `Slovak must be natural, correct, with full diacritics, as a Slovak teacher would write it for children.
English example sentences must be short, concrete and use only simple vocabulary a child at this level knows. Use British English spelling.`;

/** Coerce model output into plain strings so the UI never receives surprises. */
export const s = (v: unknown, max = 4000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
export const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
