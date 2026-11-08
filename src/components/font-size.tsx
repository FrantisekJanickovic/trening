"use client";

import { Minus, Plus } from "lucide-react";
import type { CSSProperties } from "react";
import { cx } from "@/components/ui";

/** Tri veľkosti písma v tréningu: malé, normálne, veľké. */
export const FONT_STEPS = [-1, 0, 1] as const;
export type FontStep = (typeof FONT_STEPS)[number];
const SCALE: Record<FontStep, number> = { [-1]: 0.86, 0: 1, 1: 1.18 };
const NAME: Record<FontStep, string> = { [-1]: "malé", 0: "normálne", 1: "veľké" };
const KEY = "trening.font";

export const readFontStep = (): FontStep => {
  try {
    const n = Number(localStorage.getItem(KEY));
    return (FONT_STEPS as readonly number[]).includes(n) ? (n as FontStep) : 0;
  } catch {
    return 0;
  }
};

export const saveFontStep = (s: FontStep) => {
  try {
    localStorage.setItem(KEY, String(s));
  } catch {
    /* súkromné okno alebo zakázané úložisko — veľkosť sa len nezapamätá */
  }
};

/**
 * Zväčšenie rieši `zoom`, aby sa s písmom zväčšili aj tlačidlá a rozostupy.
 * Šírka sa delí rovnakým číslom, takže obsah po zväčšení nepretečie z obrazovky.
 */
export function fontScaleStyle(step: FontStep): CSSProperties {
  const s = SCALE[step];
  return s === 1 ? {} : ({ zoom: s, width: `calc(100% / ${s})` } as CSSProperties);
}

export function FontSize({ step, onChange }: { step: FontStep; onChange: (s: FontStep) => void }) {
  const btn = "size-8 shrink-0 inline-flex items-center justify-center rounded-lg text-slate hover:text-ink hover:bg-ink/5 disabled:opacity-30 disabled:pointer-events-none";
  return (
    <div className="flex items-center" role="group" aria-label={`Veľkosť písma: ${NAME[step]}`}>
      <button type="button" className={btn} aria-label="Zmenšiť písmo" disabled={step === -1} onClick={() => onChange((step - 1) as FontStep)}>
        <Minus className="size-4" />
      </button>
      <span className={cx("text-xs font-black w-4 text-center", step === 0 ? "text-mist" : "text-ink")} aria-hidden="true">
        A
      </span>
      <button type="button" className={btn} aria-label="Zväčšiť písmo" disabled={step === 1} onClick={() => onChange((step + 1) as FontStep)}>
        <Plus className="size-4" />
      </button>
    </div>
  );
}
