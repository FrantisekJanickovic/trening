"use client";

import { Download, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, cx } from "@/components/ui";
import { isMindmap, render as renderMap, type MindMapData } from "@/lib/mindmap";
import { PAGES, downloadPdf, type PageFormat } from "@/lib/paper";
import { render as renderTimeline, type TimelineData } from "@/lib/timeline";

export type Aid = MindMapData | TimelineData;

/** Mapa a os sa kreslia inak, ale ukazujú a tlačia rovnako. */
const draw = (canvas: HTMLCanvasElement, data: Aid, px: { w: number; h: number }, caption?: string) =>
  isMindmap(data) ? renderMap(canvas, data, px, caption) : renderTimeline(canvas, data as TimelineData, px, caption);

const label = (data: Aid) => (isMindmap(data) ? `Myšlienková mapa: ${data.center}` : `Časová os: ${(data as TimelineData).title}`);

/**
 * Náhľad v pomere A4 na šírku, aby bolo vidno presne to, čo sa vytlačí.
 * Kreslí sa do canvasu, takže text používa rovnaké písmo ako appka.
 */
export function MindmapCanvas({ data, caption, className }: { data: Aid; caption?: string; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let off = false;
    const paint = () => {
      const el = box.current;
      const cv = canvas.current;
      if (off || !el || !cv) return;
      const w = Math.max(320, el.clientWidth);
      const h = Math.round((w * PAGES.a4.h) / PAGES.a4.w);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      draw(cv, data, { w: w * dpr, h: h * dpr }, caption);
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
    };
    paint();
    void document.fonts?.ready.then(paint);
    const ro = new ResizeObserver(paint);
    if (box.current) ro.observe(box.current);
    return () => {
      off = true;
      ro.disconnect();
    };
  }, [data, caption]);

  return (
    <div ref={box} className={cx("w-full", className)}>
      <canvas ref={canvas} className="w-full rounded-xl border border-line bg-white" role="img" aria-label={label(data)} />
    </div>
  );
}

/** Dve tlačidlá na stiahnutie — jediné, čo z pomôcky potrebuje dieťa. */
export function MapDownloads({ data, caption, name, size = "sm" }: { data: Aid; caption: string; name: string; size?: "sm" | "md" | "lg" }) {
  const [busy, setBusy] = useState<PageFormat | null>(null);
  const [error, setError] = useState(false);

  async function save(format: PageFormat) {
    setBusy(format);
    setError(false);
    try {
      await downloadPdf((canvas, px) => draw(canvas, data, px, caption), format, name);
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(Object.keys(PAGES) as PageFormat[]).map((f) => (
        <Button key={f} variant="outline" size={size} onClick={() => save(f)} disabled={!!busy}>
          {busy === f ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} {PAGES[f].label}
        </Button>
      ))}
      {error && <span className="text-sm font-semibold text-tomato">Stiahnutie zlyhalo, skús to znova.</span>}
    </div>
  );
}

/** Pomôcka cez celú obrazovku — na malom displeji je to jediný spôsob, ako si ju poriadne pozrieť. */
export function MindmapOverlay({ data, caption, name, onClose }: { data: Aid; caption: string; name: string; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-ink/70 p-3 sm:p-6 overflow-auto" role="dialog" aria-modal="true" aria-label={label(data)}>
      <div className="mx-auto max-w-6xl rounded-2xl bg-card p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <p className="font-black mr-auto truncate">{caption}</p>
          <MapDownloads data={data} caption={caption} name={name} />
          <button type="button" onClick={onClose} aria-label="Zavrieť" className="size-9 inline-flex items-center justify-center rounded-xl text-slate hover:bg-ink/5">
            <X className="size-5" />
          </button>
        </div>
        <MindmapCanvas data={data} caption={caption} />
        <p className="text-xs text-slate font-semibold mt-2">Na telefóne si to otoč na šírku, alebo si to stiahni a pozri na väčšej obrazovke.</p>
      </div>
    </div>
  );
}
