import { requireUser, unauthorized } from "@/lib/server-auth";

export const maxDuration = 30;

const configured = () => !!(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);

const VOICES = {
  en: {
    female: process.env.AZURE_VOICE_EN_FEMALE ?? "en-GB-SoniaNeural",
    male: process.env.AZURE_VOICE_EN_MALE ?? "en-GB-RyanNeural",
  },
  sk: {
    female: process.env.AZURE_VOICE_SK_FEMALE ?? "sk-SK-ViktoriaNeural",
    male: process.env.AZURE_VOICE_SK_MALE ?? "sk-SK-LukasNeural",
  },
} as const;

const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export async function GET(req: Request) {
  // reading the request keeps this handler dynamic (env can change without a rebuild)
  void req.headers.get("authorization");
  return Response.json({ azure: configured() });
}

export async function POST(req: Request) {
  if (!configured()) return Response.json({ error: "Azure Speech nie je nastavený." }, { status: 503 });
  const user = await requireUser(req);
  if (!user) return unauthorized();

  const body = (await req.json().catch(() => null)) as { text?: string; lang?: "en" | "sk"; gender?: "female" | "male"; slow?: boolean } | null;
  const text = body?.text?.trim().slice(0, 600);
  if (!text) return Response.json({ error: "Chýba text." }, { status: 400 });
  const lang = body?.lang === "sk" ? "sk" : "en";
  const gender = body?.gender === "male" ? "male" : "female";
  const voice = VOICES[lang][gender];
  const rate = body?.slow ? "-25%" : "-5%";
  const xmlLang = lang === "en" ? "en-GB" : "sk-SK";

  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${xmlLang}"><voice name="${voice}"><prosody rate="${rate}">${escapeXml(text)}</prosody></voice></speak>`;

  const res = await fetch(`https://${process.env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY!,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "anglictina-app",
    },
    body: ssml,
  });
  if (!res.ok) return Response.json({ error: `Azure TTS: ${res.status}` }, { status: 502 });
  return new Response(res.body, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=31536000, immutable" },
  });
}
