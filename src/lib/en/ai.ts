"use client";

import { authHeader } from "@/lib/supabase";
import type { Sentence, SourceType } from "./types";

export type DraftVocab = { en: string; sk: string; example_en?: string; example_sk?: string; emoji?: string };
export type DraftGrammar = { prompt: string; answer: string; options?: string[]; translation_sk?: string; explanation_sk?: string };
export type DraftText = { title?: string; sentences: Sentence[] };

/** One exercise found on a textbook page. */
export type PageExercise = { label: string; instruction: string; text: string; note: string; suggested: SourceType[] };
export type PageResult = { title: string; unit: string; exercises: PageExercise[] };

/** Practice items generated from one exercise for the chosen types. */
export type BuildResult = { vocab: DraftVocab[]; grammar: DraftGrammar[]; text: DraftText | null; writing: Sentence[] };

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Chyba ${res.status}`);
  return json as T;
}

/** Downscale a photo so it uploads fast and stays under request limits. */
async function toJpegBase64(file: File, max = 2000): Promise<{ data: string; mediaType: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL("image/jpeg", 0.85);
  return { data: url.split(",")[1], mediaType: "image/jpeg" };
}

/** Read one textbook page and split it into exercises with suggested practice types. */
export async function segmentPhoto(file: File, grade?: number | null): Promise<PageResult> {
  const img = await toJpegBase64(file);
  return post<PageResult>("/api/en/segment", { image: img.data, mediaType: img.mediaType, grade });
}

/** Turn one exercise into practice items for the given types. */
export async function buildFromSource(
  src: { label: string | null; instruction: string | null; content: string; types: SourceType[] },
  grade?: number | null,
): Promise<BuildResult> {
  return post<BuildResult>("/api/en/build", { ...src, grade });
}

export async function enrichVocab(items: DraftVocab[], grade?: number | null) {
  return post<{ items: DraftVocab[] }>("/api/en/enrich", { mode: "vocab", items, grade });
}

export async function generateGrammar(topic: string, words: string[], count: number, grade?: number | null) {
  return post<{ items: DraftGrammar[] }>("/api/en/enrich", { mode: "grammar", topic, words, count, grade });
}

export async function translateSentences(sentences: string[]) {
  return post<{ sentences: Sentence[] }>("/api/en/enrich", { mode: "translate", sentences });
}

export type AiInfo = { ai: boolean; provider: "anthropic" | "openai" | null; model: string | null };

/** Which AI service the server uses, if any. */
export async function aiInfo(): Promise<AiInfo> {
  try {
    const res = await fetch("/api/en/enrich", { headers: await authHeader() });
    const j = await res.json();
    return { ai: !!j.ai, provider: j.provider ?? null, model: j.model ?? null };
  } catch {
    return { ai: false, provider: null, model: null };
  }
}

export const aiStatus = async () => (await aiInfo()).ai;
