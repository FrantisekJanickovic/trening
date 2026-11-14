"use client";

import type { Aspect, ExerciseType, Payload } from "./exercises";
import type { FoundFigure } from "./figures";
import type { MindMapData } from "./mindmap";
import type { TimelineData } from "./timeline";
import { authHeader } from "./supabase";
import type { SubjectSlug } from "./types";

export type Section = { heading: string; text: string };
export type Transcript = { title: string; sections: Section[]; figures: FoundFigure[]; rotation: 0 | 90 | 180 | 270 };
export type Generated = { type: ExerciseType; payload: Payload; concept: string; level: number; aspect: Aspect; source: number | null };

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

/**
 * Fotka do podoby, akú znesie AI: zmenšená, otočená podľa EXIF a prípadne
 * dootočená o zadaný uhol. Bez `imageOrientation` by sa fotka z telefónu
 * natočená na výšku spracovala naležato.
 */
export async function toJpegBase64(file: Blob, max = 2000, rotate: 0 | 90 | 180 | 270 = 0): Promise<{ data: string; mediaType: string; blob: Blob }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const swap = rotate === 90 || rotate === 270;
  const canvas = document.createElement("canvas");
  canvas.width = swap ? h : w;
  canvas.height = swap ? w : h;
  const ctx = canvas.getContext("2d")!;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotate * Math.PI) / 180);
  ctx.drawImage(bitmap, -w / 2, -h / 2, w, h);
  const url = canvas.toDataURL("image/jpeg", 0.85);
  const blob = await (await fetch(url)).blob();
  return { data: url.split(",")[1], mediaType: "image/jpeg", blob };
}

export const transcribe = (image: { data: string; mediaType: string }, subject: SubjectSlug, grade: number | null) =>
  post<Transcript>("/api/ai/transcribe", { image: image.data, mediaType: image.mediaType, subject, grade });

export const readVerbs = (image: { data: string; mediaType: string }) =>
  post<{ verbs: { base: string; past: string; participle: string; sk: string }[]; rotation: 0 | 90 | 180 | 270 }>("/api/ai/verbs", {
    image: image.data,
    mediaType: image.mediaType,
  });

type AidInput = { subject: SubjectSlug; grade: number | null; title: string; scope: string; sections: Section[]; prompt: string };

export const generateMindmap = (input: AidInput) => post<{ map: MindMapData }>("/api/ai/mindmap", input);

export const generateTimeline = (input: AidInput) => post<{ timeline: TimelineData }>("/api/ai/timeline", input);

export const factcheck = (input: { subject: SubjectSlug; grade: number | null; title: string; sections: Section[]; items: { id: string; text: string }[] }) =>
  post<{ results: { id: string; ok: boolean; note: string }[]; missing: string[] }>("/api/ai/factcheck", input);

/** Cvičenie, na ktoré sa rodič odvolal kódom v prompte. */
export type ExerciseRef = { code: string; type: string; text: string; solution: string };

export const generateExercises = (input: {
  subject: SubjectSlug;
  grade: number | null;
  title: string;
  sections: Section[];
  types: ExerciseType[];
  count: number;
  avoid?: string[];
  instruction?: string;
  refs?: ExerciseRef[];
}) => post<{ exercises: Generated[] }>("/api/ai/exercises", input);

export type Revised = { type: ExerciseType; payload: Payload; concept: string; level: number };
export type Revision = { note: string; fixed: { payload: Payload; concept: string } | null; added: Revised[]; figure: string | null };

/** Pokyn rodiča v kontexte jedného cvičenia: oprava, nové typy, variácie alebo obrázok. */
export const reviseExercise = (input: {
  subject: SubjectSlug;
  grade: number | null;
  title: string;
  sections: Section[];
  types: ExerciseType[];
  count: number;
  action: string;
  instruction: string;
  target: ExerciseRef & { concept: string; payload: Payload };
  refs?: ExerciseRef[];
  figures?: { id: string; caption: string; explain: string }[];
}) => post<Revision>("/api/ai/revise", input);
