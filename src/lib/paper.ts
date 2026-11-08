/**
 * Spoločné pre tlačiteľné pomôcky (myšlienková mapa, časová os):
 * formáty strán, kreslenie na canvas a uloženie do PDF.
 */

export const PAGES = {
  a4: { w: 297, h: 210, label: "A4" },
  a3: { w: 420, h: 297, label: "A3" },
} as const;
export type PageFormat = keyof typeof PAGES;

export const FONT = (weight: number, size: number) => `${weight} ${size}px "Nunito Variable", ui-rounded, system-ui, sans-serif`;

export const INK = "#1b2559";
export const SLATE = "#49527a";

/** Paleta vetiev a udalostí — tie isté farby, aké používa appka. */
export const COLORS = [
  { line: "#3d6cf0", soft: "#e4ebfe" },
  { line: "#1f9d63", soft: "#e1f6ec" },
  { line: "#e0a500", soft: "#fff4d1" },
  { line: "#e5484d", soft: "#fde8e8" },
  { line: "#8b5cf6", soft: "#efe9fe" },
  { line: "#0ea5a4", soft: "#dcf7f6" },
  { line: "#db2777", soft: "#fce7f3" },
];

export function wrap(ctx: CanvasRenderingContext2D, text: string, font: string, maxW: number): string[] {
  ctx.font = font;
  const words = String(text ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return [""];
  const out: string[] = [];
  let line = words[0];
  for (const w of words.slice(1)) {
    const next = `${line} ${w}`;
    if (ctx.measureText(next).width <= maxW) line = next;
    else {
      out.push(line);
      line = w;
    }
  }
  out.push(line);
  return out;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function textLines(ctx: CanvasRenderingContext2D, lines: string[], x: number, y: number, lineH: number, font: string, color: string) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = "top";
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineH));
}

/** Nadpis v rohu strany: z ktorej lekcie a z ktorých strán pomôcka je. */
export function paintCaption(ctx: CanvasRenderingContext2D, caption: string, margin: number, capH: number) {
  const size = Math.round(capH * 0.62);
  ctx.font = FONT(700, size);
  ctx.fillStyle = SLATE;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(caption, margin, margin);
}

const safeName = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 60) || "pomocka";

/**
 * Uloží pomôcku ako PDF presne v danom formáte na šírku.
 * 200 dpi je pre tlač dosť a súbor ostane rozumne veľký.
 */
export async function downloadPdf(
  draw: (canvas: HTMLCanvasElement, px: { w: number; h: number }) => void,
  format: PageFormat,
  name: string,
) {
  const page = PAGES[format];
  const dpi = 200;
  const px = { w: Math.round((page.w / 25.4) * dpi), h: Math.round((page.h / 25.4) * dpi) };
  if (typeof document !== "undefined" && document.fonts?.ready) await document.fonts.ready;

  const canvas = document.createElement("canvas");
  draw(canvas, px);

  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format });
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, page.w, page.h);
  pdf.save(`${safeName(name)}-${format}.pdf`);
}
