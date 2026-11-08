"use client";

import { supabase } from "./supabase";
import type { Figure } from "./types";

export const BUCKET = "lekcie";

/** Čo AI našla na strane: rámček v podieloch strany a texty k nemu. */
export type FoundFigure = { box: [number, number, number, number]; caption: string; explain: string };

const loadImage = (file: Blob) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Obrázok sa nepodarilo načítať."));
    };
    img.src = url;
  });

const toBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Výrez sa nepodaril."))), "image/jpeg", 0.88));

/**
 * Vyreže z nafotenej strany jednotlivé obrázky.
 * Rámček od AI trochu rozšírime — radšej kúsok okolia navyše než odseknutý okraj —
 * a výrez zmenšíme na rozumnú šírku, nech galéria nenaťahuje megabajty.
 */
export async function cropFigures(file: Blob, found: FoundFigure[], maxWidth = 1100): Promise<{ blob: Blob; caption: string; explain: string }[]> {
  if (!found.length) return [];
  const img = await loadImage(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];

  const out: { blob: Blob; caption: string; explain: string }[] = [];
  for (const f of found) {
    const pad = 0.012;
    const x0 = Math.max(0, f.box[0] - pad) * img.naturalWidth;
    const y0 = Math.max(0, f.box[1] - pad) * img.naturalHeight;
    const x1 = Math.min(1, f.box[2] + pad) * img.naturalWidth;
    const y1 = Math.min(1, f.box[3] + pad) * img.naturalHeight;
    const w = Math.round(x1 - x0);
    const h = Math.round(y1 - y0);
    if (w < 60 || h < 40) continue;

    const scale = Math.min(1, maxWidth / w);
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, x0, y0, w, h, 0, 0, canvas.width, canvas.height);
    out.push({ blob: await toBlob(canvas), caption: f.caption, explain: f.explain });
  }
  return out;
}

/** Uloží výrezy do úložiska a zapíše ich k lekcii. Cesta vždy začína vlastníkom kvôli RLS. */
export async function saveFigures(
  lessonId: string,
  sourceId: string | null,
  page: number,
  crops: { blob: Blob; caption: string; explain: string }[],
  startPosition: number,
) {
  if (!crops.length) return 0;
  const sb = supabase();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) throw new Error("Nie si prihlásený.");

  const rows: Omit<Figure, "id" | "created_at">[] = [];
  for (const [i, c] of crops.entries()) {
    const path = `${u.user.id}/${lessonId}/${crypto.randomUUID()}.jpg`;
    const { error } = await sb.storage.from(BUCKET).upload(path, c.blob, { contentType: "image/jpeg", upsert: false });
    if (error) throw new Error(error.message);
    rows.push({ lesson_id: lessonId, source_id: sourceId, page, path, caption: c.caption, explain: c.explain, position: startPosition + i });
  }
  const { error } = await sb.from("tr_figures").insert(rows);
  if (error) throw new Error(error.message);
  return rows.length;
}

export async function deleteFigure(f: Figure) {
  const sb = supabase();
  await sb.storage.from(BUCKET).remove([f.path]);
  const { error } = await sb.from("tr_figures").delete().eq("id", f.id);
  if (error) throw new Error(error.message);
}

/**
 * Podpísané adresy na zobrazenie. Úložisko je súkromné, takže sa adresy
 * podpisujú na hodinu a vypýtajú naraz pre celú galériu.
 */
export async function figureUrls(figures: Figure[]): Promise<Record<string, string>> {
  if (!figures.length) return {};
  const { data, error } = await supabase()
    .storage.from(BUCKET)
    .createSignedUrls(
      figures.map((f) => f.path),
      3600,
    );
  if (error) throw new Error(error.message);
  const out: Record<string, string> = {};
  for (const [i, d] of (data ?? []).entries()) if (d.signedUrl) out[figures[i].id] = d.signedUrl;
  return out;
}
