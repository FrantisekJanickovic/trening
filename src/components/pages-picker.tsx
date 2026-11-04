"use client";

import { cx } from "@/components/ui";

/**
 * Riadok checkboxov s číslami strán lekcie. Prvý je „Všetky strany“ — zaškrtnutie
 * zaškrtne aj všetky ostatné, odškrtnutie ich pustí. Všetky sú plnohodnotné
 * checkboxy, takže sa dá kombinovať ľubovoľne.
 */
export function PagePicker({
  pages,
  value,
  onChange,
  idPrefix,
  label = "Strany",
}: {
  pages: number[];
  value: number[];
  onChange: (next: number[]) => void;
  idPrefix: string;
  label?: string;
}) {
  if (pages.length <= 1) return null;
  const all = value.length === 0 || value.length === pages.length;
  const isOn = (p: number) => all || value.includes(p);

  function togglePage(p: number) {
    const current = all ? [...pages] : value;
    const next = current.includes(p) ? current.filter((x) => x !== p) : [...current, p];
    onChange(next.length === pages.length ? [] : next.sort((a, b) => a - b));
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="text-sm font-black text-slate">{label}:</span>
      <label className={cx("inline-flex items-center gap-1.5 text-sm font-bold cursor-pointer", all ? "text-ink" : "text-slate")}>
        <input
          type="checkbox"
          checked={all}
          onChange={() => onChange(all ? [pages[0]] : [])}
          className="size-4 accent-[#1b2559]"
          id={`${idPrefix}-all`}
        />
        Všetky strany
      </label>
      {pages.map((p) => (
        <label key={p} className={cx("inline-flex items-center gap-1.5 text-sm font-bold cursor-pointer", isOn(p) ? "text-ink" : "text-slate")}>
          <input type="checkbox" checked={isOn(p)} onChange={() => togglePage(p)} className="size-4 accent-[#1b2559]" id={`${idPrefix}-p${p}`} />
          {p}
        </label>
      ))}
    </div>
  );
}
