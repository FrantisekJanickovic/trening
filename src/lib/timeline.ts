/**
 * Časová os udalostí.
 *
 * Kreslí sa ako cesta, ktorá sa kľukatí po strane: zľava doprava, potom o riadok
 * nižšie sprava doľava. Na šírku A4 sa tak zmestí osem aj dvanásť udalostí a každá
 * má miesto na vetu, čo sa pri rovnej osi cez celú stranu nedá.
 */
import { COLORS, FONT, INK, SLATE, paintCaption, roundRect, textLines, wrap } from "./paper";

export type TimelineEvent = {
  /** ako sa rok píše v učebnici: „833“, „okolo 907“, „9. storočie“ */
  year: string;
  title: string;
  text?: string;
  /** čo udalosť spája s predchádzajúcou, pár slov; kreslí sa na cestu medzi nimi */
  link?: string;
  icon?: string;
};

export type TimelineData = { title: string; events: TimelineEvent[] };

export const isTimeline = (d: unknown): d is TimelineData => !!d && typeof d === "object" && Array.isArray((d as TimelineData).events);

const F_YEAR = { font: FONT(900, 26), line: 32 };
const F_TITLE = { font: FONT(800, 19), line: 25 };
const F_TEXT = { font: FONT(600, 15), line: 21 };
const F_LINK = { font: FONT(700, 13), line: 17 };

const CARD_W = 300;
const PAD = 16;
const GAP_X = 100;
const GAP_Y = 64;
const ICON = 34;

type Card = { x: number; y: number; w: number; h: number; year: string; icon?: string; title: string[]; text: string[]; link?: string; color: number };
export type TimelineLayout = { cards: Card[]; perRow: number; width: number; height: number };

export function layout(ctx: CanvasRenderingContext2D, data: TimelineData, perRowWanted?: number, gapY = GAP_Y): TimelineLayout {
  const events = data.events.slice(0, 14);
  const perRow = Math.max(1, Math.min(perRowWanted ?? Math.min(4, events.length), events.length));

  const measured = events.map((e) => {
    const title = wrap(ctx, e.title, F_TITLE.font, CARD_W - 2 * PAD);
    const text = e.text ? wrap(ctx, e.text, F_TEXT.font, CARD_W - 2 * PAD) : [];
    const h = PAD + F_YEAR.line + 6 + title.length * F_TITLE.line + (text.length ? 4 + text.length * F_TEXT.line : 0) + PAD;
    return { ...e, title, text, h };
  });

  const rows: (typeof measured)[] = [];
  for (let i = 0; i < measured.length; i += perRow) rows.push(measured.slice(i, i + perRow));

  const cards: Card[] = [];
  let y = 0;
  rows.forEach((row, r) => {
    const rowH = Math.max(...row.map((m) => m.h));
    row.forEach((m, c) => {
      // nepárny riadok ide sprava doľava, aby cesta plynule pokračovala
      const col = r % 2 === 0 ? c : perRow - 1 - c;
      const idx = r * perRow + c;
      cards.push({
        x: col * (CARD_W + GAP_X),
        y: y + (rowH - m.h) / 2,
        w: CARD_W,
        h: m.h,
        year: m.year,
        icon: m.icon,
        title: m.title,
        text: m.text,
        link: m.link,
        color: idx % COLORS.length,
      });
    });
    y += rowH + gapY;
  });

  return { cards, perRow, width: perRow * CARD_W + (perRow - 1) * GAP_X, height: Math.max(0, y - gapY) };
}

/** Cesta medzi dvoma kartami: v riadku rovno, na konci riadka oblúk o poschodie nižšie. */
function ribbon(ctx: CanvasRenderingContext2D, a: Card, b: Card, color: string) {
  const sameRow = Math.abs(a.y + a.h / 2 - (b.y + b.h / 2)) < Math.max(a.h, b.h);
  ctx.strokeStyle = color;
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  if (sameRow) {
    const left = a.x < b.x;
    const y = (a.y + a.h / 2 + b.y + b.h / 2) / 2;
    ctx.moveTo(left ? a.x + a.w : a.x, y);
    ctx.lineTo(left ? b.x : b.x + b.w, y);
  } else {
    const x = a.x + a.w / 2;
    const x2 = b.x + b.w / 2;
    const y1 = a.y + a.h;
    const y2 = b.y;
    const mid = (y1 + y2) / 2;
    ctx.moveTo(x, y1);
    ctx.bezierCurveTo(x, mid, x2, mid, x2, y2);
  }
  ctx.stroke();
}

/** Krátke „prečo nasleduje“ na bielom štítku, aby sa to dalo prečítať aj cez cestu. */
function linkChip(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, color: string) {
  ctx.font = F_LINK.font;
  const w = ctx.measureText(text).width + 18;
  const h = 24;
  roundRect(ctx, cx - w / 2, cy - h / 2, w, h, 12);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, cy + 1);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
}

export function paint(ctx: CanvasRenderingContext2D, l: TimelineLayout) {
  for (let i = 0; i < l.cards.length - 1; i++) ribbon(ctx, l.cards[i], l.cards[i + 1], COLORS[l.cards[i].color].line);

  for (const c of l.cards) {
    const col = COLORS[c.color];
    roundRect(ctx, c.x, c.y, c.w, c.h, 20);
    ctx.fillStyle = col.soft;
    ctx.fill();
    ctx.strokeStyle = col.line;
    ctx.lineWidth = 3;
    ctx.stroke();

    // rok v pilulke, ikonka vpravo hore
    ctx.font = F_YEAR.font;
    const yw = ctx.measureText(c.year).width + 22;
    roundRect(ctx, c.x + PAD, c.y + PAD - 4, yw, F_YEAR.line, 14);
    ctx.fillStyle = col.line;
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";
    ctx.fillText(c.year, c.x + PAD + 11, c.y + PAD - 4 + F_YEAR.line / 2 + 1);
    ctx.textBaseline = "top";

    if (c.icon) {
      ctx.font = FONT(400, ICON);
      ctx.textAlign = "right";
      ctx.fillText(c.icon, c.x + c.w - PAD, c.y + PAD - 6);
      ctx.textAlign = "left";
    }

    let ty = c.y + PAD + F_YEAR.line + 6;
    textLines(ctx, c.title, c.x + PAD, ty, F_TITLE.line, F_TITLE.font, INK);
    ty += c.title.length * F_TITLE.line + 4;
    if (c.text.length) textLines(ctx, c.text, c.x + PAD, ty, F_TEXT.line, F_TEXT.font, SLATE);
  }

  // štítky so súvislosťami idú navrch, nech ich karty neprekryjú
  for (let i = 1; i < l.cards.length; i++) {
    const a = l.cards[i - 1];
    const b = l.cards[i];
    if (!b.link) continue;
    const sameRow = Math.abs(a.y + a.h / 2 - (b.y + b.h / 2)) < Math.max(a.h, b.h);
    const cx = sameRow ? (a.x + a.w / 2 + b.x + b.w / 2) / 2 : (a.x + a.w / 2 + b.x + b.w / 2) / 2;
    const cy = sameRow ? (a.y + a.h / 2 + b.y + b.h / 2) / 2 : (a.y + a.h + b.y) / 2;
    linkChip(ctx, b.link, cx, cy, COLORS[a.color].line);
  }
}

export function render(canvas: HTMLCanvasElement, data: TimelineData, px: { w: number; h: number }, caption?: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = Math.round(px.w);
  canvas.height = Math.round(px.h);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const margin = Math.round(Math.min(px.w, px.h) * 0.035);
  const capH = Math.round(Math.min(px.w, px.h) * 0.035);
  const headH = Math.round(Math.min(px.w, px.h) * 0.06);
  const availW = px.w - 2 * margin;
  const availH = px.h - 2 * margin - capH - headH;

  // Vyskúšame viac rozložení a vezmeme to, ktoré stranu zaplní najlepšie —
  // inak by os z pár udalostí ostala ako úzky prúžok uprostred prázdnej strany.
  let l = layout(ctx, data);
  let best = 0;
  for (let perRow = 2; perRow <= Math.min(5, data.events.length); perRow++) {
    const cand = layout(ctx, data, perRow);
    const fit = Math.min(availW / cand.width, availH / cand.height);
    if (fit > best) {
      best = fit;
      l = cand;
    }
  }
  // zvyšnú výšku rozdáme medzi riadky, nech os nevisí v hornej polovici
  const rows = Math.ceil(l.cards.length / l.perRow);
  if (rows > 1 && l.width / l.height > availW / availH) {
    const extra = (l.width * (availH / availW) - l.height) / (rows - 1);
    if (extra > 0) l = layout(ctx, data, l.perRow, GAP_Y + Math.min(extra, 220));
  }
  const scale = Math.min(availW / Math.max(1, l.width), availH / Math.max(1, l.height), 2.2);

  if (caption) paintCaption(ctx, caption, margin, capH);
  ctx.font = FONT(900, Math.round(headH * 0.68));
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(data.title, px.w / 2, margin + capH);
  ctx.textAlign = "left";

  ctx.save();
  ctx.translate((px.w - l.width * scale) / 2, margin + capH + headH + (availH - l.height * scale) / 2);
  ctx.scale(scale, scale);
  paint(ctx, l);
  ctx.restore();
}