"use client";

import type { ExerciseType, Payload } from "./exercises";
import { authHeader } from "./supabase";
import type { SubjectSlug } from "./types";

export type Section = { heading: string; text: string };
export type Transcript = { title: string; sections: Section[] };
export type Generated = { type: ExerciseType; payload: Payload; concept: string; level: number; source: number | null };

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", ...(await authHeader()) }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Chyba ${res.status}`);
  return json as T;
}

export async function aiInfo(): Promise<{ ai: boolean; model: string | null }> {
  try {
    const res = await fetch("/api/ai/transcribe", { headers: await authHeader() });
    const j = await res.json();
    return { ai: !!j.ai, model: j.model ?? null };
  } catch {
    return { ai: false, model: null };
  }
}

/** Zmenší fotku, nech sa rýchlo nahrá a zmestí do požiadavky. */
export async function toJpegBase64(file: File, max = 2000): Promise<{ data: string; mediaType: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return { data: canvas.toDataURL("image/jpeg", 0.85).split(",")[1], mediaType: "image/jpeg" };
}

export const transcribe = (image: { data: string; mediaType: string }, subject: SubjectSlug, grade: number | null) =>
  post<Transcript>("/api/ai/transcribe", { image: image.data, mediaType: image.mediaType, subject, grade });

export const generateExercises = (input: {
  subject: SubjectSlug;
  grade: number | null;
  title: string;
  sections: Section[];
  types: ExerciseType[];
  count: number;
  avoid?: string[];
}) => post<{ exercises: Generated[] }>("/api/ai/exercises", input);
