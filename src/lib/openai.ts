/** Server-side connector to the OpenAI Responses API with one forced function call (structured output). */

type JsonSchema = Record<string, unknown>;

export const aiConfigured = () => !!process.env.OPENAI_API_KEY;
export const aiModel = () => process.env.OPENAI_MODEL || "gpt-6-sol";
export const NOT_CONFIGURED = "AI nie je nastavené: vo Verceli chýba kľúč OPENAI_API_KEY.";

type Output = { type: string; name?: string; arguments?: string };
type Response = { status?: string; output?: Output[]; error?: { message?: string } | null };

function errorText(status: number, message: string | undefined, model: string) {
  if (status === 401) return "OpenAI odmietlo kľúč OPENAI_API_KEY. Skontroluj, či je vo Verceli skopírovaný celý.";
  if (status === 429) return "OpenAI: prekročený limit alebo došiel kredit na účte (platform.openai.com → Billing).";
  if (status === 404 || /model/i.test(message ?? "")) return `OpenAI: model ${model} nie je dostupný (${message ?? status}). Nastav iný v OPENAI_MODEL.`;
  return `OpenAI: ${message ?? `chyba ${status}`}`;
}

export async function structured<T>(opts: {
  system: string;
  prompt: string;
  toolName: string;
  description: string;
  schema: JsonSchema;
  maxTokens?: number;
}): Promise<T> {
  if (!aiConfigured()) throw new Error(NOT_CONFIGURED);
  const model = aiModel();
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const reasoning = /^(gpt-5|gpt-6|o\d)/.test(model) ? { reasoning: { effort: process.env.OPENAI_REASONING_EFFORT || "low" } } : {};
  const res = await fetch(`${base}/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model,
      instructions: opts.system,
      input: [{ role: "user", content: [{ type: "input_text", text: opts.prompt }] }],
      tools: [{ type: "function", name: opts.toolName, description: opts.description, parameters: opts.schema, strict: false }],
      tool_choice: { type: "function", name: opts.toolName },
      max_output_tokens: opts.maxTokens ?? 24000,
      store: false,
      ...reasoning,
    }),
  });
  const json = (await res.json().catch(() => null)) as Response | null;
  if (!res.ok) throw new Error(errorText(res.status, json?.error?.message, model));
  const call = json?.output?.find((o) => o.type === "function_call" && o.name === opts.toolName);
  if (!call?.arguments) {
    if (json?.status === "incomplete") throw new Error("AI nestihla dokončiť odpoveď. Skús to znova.");
    throw new Error("AI nevrátila výsledok.");
  }
  try {
    return JSON.parse(call.arguments) as T;
  } catch {
    throw new Error("AI vrátila neúplný výsledok. Skús to znova.");
  }
}
