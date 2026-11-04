"use client";

import { Download, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, cx } from "@/components/ui";
import { PAGES, downloadPdf, render, type MindMapData, type PageFormat } from "@/lib/mindmap";

/**
 * Náhľad mapy v pomere A4 na šírku, aby bolo vidno presne to, čo sa vytlačí.
 * Kreslí sa do canvasu, takže text používa rovnaké písmo ako zvyšok appky.
 */
export function MindmapCanvas({ data, caption, className }: { data: MindMapData; caption?: string; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let off = false;
    const draw = () => {
      const el = box.current;
      const cv = canvas.current;
      if (off || !el || !cv) return;
      const w = Math.max(320, el.clientWidth);
      const h = Math.round((w * PAGES.a4.h) / PAGES.a4.w);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      render(cv, data, { w: w * dpr, h: h * dpr }, caption);
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
    };
    draw();
    void document.fonts?.ready.then(draw);
    const ro = new ResizeObserver(draw);
    if (box.current) ro.observe(box.current);
    return () => {
      off = true;
      ro.disconnect();
    };
  }, [data, caption]);

  return (
    <div ref={box} className={cx("w-full", className)}>
      <canvas ref={canvas} className="w-full rounded-xl border border-line bg-white" role="img" aria-label={`Myšlienková mapa: ${data.center}`} />
    </div>
  );
}

/** Dve tlačidlá na stiahnutie — jediné, čo z mapy potrebuje dieťa. */
export function MapDownloads({ data, caption, name, size = "sm" }: { data: MindMapData; caption: string; name: string; size?: "sm" | "md" | "lg" }) {
  const [busy, setBusy] = useState<PageFormat | null>(null);
  const [error, setError] = useState(false);

  async function save(format: PageFormat) {
    setBusy(format);
    setError(false);
    try {
      await downloadPdf(data, format, caption, name);
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

/** Mapa cez celú obrazovku — na malom displeji je to jediný spôsob, ako si ju poriadne pozrieť. */
export function MindmapOverlay({ data, caption, name, onClose }: { data: MindMapData; caption: string; name: string; onClose: () => void }) {
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
    <div className="fixed inset-0 z-50 bg-ink/70 p-3 sm:p-6 overflow-auto" role="dialog" aria-modal="true" aria-label={`Myšlienková mapa: ${data.center}`}>
      <div className="mx-auto max-w-6xl rounded-2xl bg-card p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <p className="font-black mr-auto truncate">{caption}</p>
          <MapDownloads data={data} caption={caption} name={name} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Zavrieť mapu"
            className="size-9 inline-flex items-center justify-center rounded-xl text-slate hover:bg-ink/5"
          >
            <X className="size-5" />
          </button>
        </div>
        <MindmapCanvas data={data} caption={caption} />
        <p className="text-xs text-slate font-semibold mt-2">Na telefóne si mapu otoč na šírku, alebo si ju stiahni a pozri na väčšej obrazovke.</p>
      </div>
    </div>
  );
}
