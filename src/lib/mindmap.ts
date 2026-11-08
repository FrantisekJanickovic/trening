/**
 * Myšlienková mapa: rozloženie a kreslenie.
 *
 * Jedno rozloženie slúži na náhľad aj na tlač — mapa sa vyskladá v návrhových
 * jednotkách a potom sa len preškáluje na cieľovú plochu. Kreslí sa do canvasu,
 * aby text používal rovnaké písmo ako appka (SVG načítaný ako obrázok by o fonte
 * nevedel) a aby diakritika vyšla vždy správne.
 */
import { COLORS, FONT, INK, SLATE, paintCaption, roundRect, textLines, wrap } from "./paper";

export type MindItem = { label: string; items?: string[] };
export type MindBranch = { label: string; items: MindItem[] };
export type MindMapData = { center: string; branches: MindBranch[] };

export const isMindmap = (d: unknown): d is MindMapData => !!d && typeof d === "object" && Array.isArray((d as MindMapData).branches);

const F_CENTER = { font: FONT(900, 34), line: 42 };
const F_BRANCH = { font: FONT(800, 21), line: 27 };
const F_ITEM = { font: FONT(700, 17), line: 23 };
const F_SUB = { font: FONT(600, 14), line: 19 };

const PAD = 14;
const CENTER_W = 320;
const BRANCH_W = 250;
const ITEM_W = 340;
const ITEM_GAP = 12;
const BLOCK_GAP = 34;
const COL_GAP = 56;
const SUB_INDENT = 16;

type Box = { x: number; y: number; w: number; h: number; lines: string[] };
type LaidItem = Box & { subs: { lines: string[]; y: number; h: number } };
type LaidBranch = { side: 1 | -1; color: (typeof COLORS)[number]; box: Box; items: LaidItem[] };
export type Layout = { center: Box; branches: LaidBranch[]; width: number; height: number };

/** Vyskladá mapu okolo stredu v bode (0, 0); súradnice sa na konci posunú do kladných čísel. */
export function layout(ctx: CanvasRenderingContext2D, data: MindMapData, blockGap = BLOCK_GAP): Layout {
  const centerLines = wrap(ctx, data.center, F_CENTER.font, CENTER_W - 2 * PAD);
  const centerH = centerLines.length * F_CENTER.line + 2 * PAD;
  const centerW = CENTER_W;

  type Pre = { lines: string[]; h: number; items: { lines: string[]; subs: string[][]; h: number }[]; blockH: number };
  const pre: Pre[] = data.branches.map((b) => {
    const lines = wrap(ctx, b.label, F_BRANCH.font, BRANCH_W - 2 * PAD);
    const h = lines.length * F_BRANCH.line + 2 * PAD;
    const items = (b.items ?? []).map((it) => {
      const il = wrap(ctx, it.label, F_ITEM.font, ITEM_W - 2 * PAD);
      const subs = (it.items ?? []).map((s) => wrap(ctx, s, F_SUB.font, ITEM_W - 2 * PAD - SUB_INDENT));
      const subH = subs.reduce((n, s) => n + s.length * F_SUB.line, 0);
      return { lines: il, subs, h: il.length * F_ITEM.line + (subH ? subH + 6 : 0) + 2 * PAD };
    });
    const itemsH = items.reduce((n, i) => n + i.h, 0) + Math.max(0, items.length - 1) * ITEM_GAP;
    return { lines, h, items, blockH: Math.max(h, itemsH) };
  });

  const half = Math.ceil(pre.length / 2);
  const sides: { side: 1 | -1; idx: number[] }[] = [
    { side: 1, idx: pre.map((_, i) => i).slice(0, half) },
    { side: -1, idx: pre.map((_, i) => i).slice(half) },
  ];

  const branches: LaidBranch[] = [];
  for (const { side, idx } of sides) {
    if (!idx.length) continue;
    const totalH = idx.reduce((n, i) => n + pre[i].blockH, 0) + (idx.length - 1) * blockGap;
    let y = -totalH / 2;
    for (const i of idx) {
      const p = pre[i];
      const boxX = side === 1 ? centerW / 2 + COL_GAP : -centerW / 2 - COL_GAP - BRANCH_W;
      const box: Box = { x: boxX, y: y + (p.blockH - p.h) / 2, w: BRANCH_W, h: p.h, lines: p.lines };

      const itemsH = p.items.reduce((n, it) => n + it.h, 0) + Math.max(0, p.items.length - 1) * ITEM_GAP;
      const itemX = side === 1 ? boxX + BRANCH_W + COL_GAP : boxX - COL_GAP - ITEM_W;
      let iy = y + (p.blockH - itemsH) / 2;
      const items: LaidItem[] = p.items.map((it) => {
        const subH = it.subs.reduce((n, s) => n + s.length * F_SUB.line, 0);
        const laid: LaidItem = {
          x: itemX,
          y: iy,
          w: ITEM_W,
          h: it.h,
          lines: it.lines,
          subs: { lines: it.subs.flat(), y: iy + PAD + it.lines.length * F_ITEM.line + 6, h: subH },
        };
        iy += it.h + ITEM_GAP;
        return laid;
      });

      branches.push({ side, color: COLORS[i % COLORS.length], box, items });
      y += p.blockH + blockGap;
    }
  }

  const center: Box = { x: -centerW / 2, y: -centerH / 2, w: centerW, h: centerH, lines: centerLines };
  const xs = [center.x, center.x + center.w];
  const ys = [center.y, center.y + center.h];
  for (const b of branches) {
    xs.push(b.box.x, b.box.x + b.box.w);
    ys.push(b.box.y, b.box.y + b.box.h);
    for (const it of b.items) {
      xs.push(it.x, it.x + it.w);
      ys.push(it.y, it.y + it.h);
    }
  }
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const shift = <T extends { x: number; y: number }>(o: T) => ({ ...o, x: o.x - minX, y: o.y - minY });

  return {
    center: shift(center),
    branches: branches.map((b) => ({
      ...b,
      box: shift(b.box),
      items: b.items.map((it) => ({ ...shift(it), subs: { ...it.subs, y: it.subs.y - minY } })),
    })),
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
  };
}

/** Krivka od okraja jedného boxu k okraju druhého — mäkká, nie lomená čiara. */
function connect(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, width: number) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  const mid = (x1 + x2) / 2;
  ctx.bezierCurveTo(mid, y1, mid, y2, x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.stroke();
}

export function paint(ctx: CanvasRenderingContext2D, l: Layout) {
  // spojnice najprv, nech ich boxy prekryjú
  for (const b of l.branches) {
    const cx = b.side === 1 ? l.center.x + l.center.w : l.center.x;
    const cy = l.center.y + l.center.h / 2;
    const bx = b.side === 1 ? b.box.x : b.box.x + b.box.w;
    const by = b.box.y + b.box.h / 2;
    connect(ctx, cx, cy, bx, by, b.color.line, 4);
    for (const it of b.items) {
      const ix = b.side === 1 ? it.x : it.x + it.w;
      const iy = it.y + Math.min(it.h / 2, PAD + 11);
      connect(ctx, b.side === 1 ? b.box.x + b.box.w : b.box.x, by, ix, iy, b.color.line, 2);
    }
  }

  // stred
  roundRect(ctx, l.center.x, l.center.y, l.center.w, l.center.h, 22);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.textAlign = "center";
  textLines(ctx, l.center.lines, l.center.x + l.center.w / 2, l.center.y + PAD, F_CENTER.line, F_CENTER.font, "#ffffff");
  ctx.textAlign = "left";

  for (const b of l.branches) {
    roundRect(ctx, b.box.x, b.box.y, b.box.w, b.box.h, 16);
    ctx.fillStyle = b.color.line;
    ctx.fill();
    ctx.textAlign = "center";
    textLines(ctx, b.box.lines, b.box.x + b.box.w / 2, b.box.y + PAD, F_BRANCH.line, F_BRANCH.font, "#ffffff");
    ctx.textAlign = "left";

    for (const it of b.items) {
      roundRect(ctx, it.x, it.y, it.w, it.h, 12);
      ctx.fillStyle = b.color.soft;
      ctx.fill();
      ctx.strokeStyle = b.color.line;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      textLines(ctx, it.lines, it.x + PAD, it.y + PAD, F_ITEM.line, F_ITEM.font, INK);
      if (it.subs.lines.length) {
        ctx.fillStyle = b.color.line;
        it.subs.lines.forEach((_, i) => ctx.fillRect(it.x + PAD + 3, it.subs.y + i * F_SUB.line + 8, 5, 2));
        textLines(ctx, it.subs.lines, it.x + PAD + SUB_INDENT, it.subs.y, F_SUB.line, F_SUB.font, SLATE);
      }
    }
  }
}

/** Vykreslí mapu na canvas danej veľkosti: biele pozadie, mapa na stred, s okrajom. */
export function render(canvas: HTMLCanvasElement, data: MindMapData, px: { w: number; h: number }, caption?: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = Math.round(px.w);
  canvas.height = Math.round(px.h);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const margin = Math.round(Math.min(px.w, px.h) * 0.035);
  const capH = caption ? Math.round(Math.min(px.w, px.h) * 0.035) : 0;
  const availW = px.w - 2 * margin;
  const availH = px.h - 2 * margin - capH;

  // Mapa býva širšia než strana, takže by ostal pás prázdna hore aj dole a text by
  // vyšiel zbytočne malý. Vetvy preto rozostupom roztiahneme na výšku strany.
  let l = layout(ctx, data);
  const gaps = Math.ceil(data.branches.length / 2) - 1;
  if (gaps > 0 && l.width / l.height > availW / availH) {
    const extra = (l.width * (availH / availW) - l.height) / gaps;
    if (extra > 0) l = layout(ctx, data, BLOCK_GAP + Math.min(extra, 150));
  }
  // horný strop, aby mapa z dvoch vetiev nemala písmená cez pol strany
  const scale = Math.min(availW / l.width, availH / l.height, 2.4);

  ctx.save();
  ctx.translate((px.w - l.width * scale) / 2, margin + capH + (px.h - 2 * margin - capH - l.height * scale) / 2);
  ctx.scale(scale, scale);
  paint(ctx, l);
  ctx.restore();

  if (caption) paintCaption(ctx, caption, margin, capH);
}

/** Popis, z čoho mapa vznikla — ide do hlavičky tlače aj do zoznamu v appke. */
export const pagesLabel = (pages: number[]) =>
  !pages.length ? "celá kapitola" : pages.length === 1 ? `strana ${pages[0]}` : `strany ${[...pages].sort((a, b) => a - b).join(", ")}`;
