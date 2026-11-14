"use client";

import { Check, ChevronDown, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cleanTypes, SOURCE_TYPES, sourceTypeLabel } from "@/lib/en/sources";
import type { SourceType } from "@/lib/en/types";
import { cx } from "@/components/ui";

/**
 * Multi-select of practice types shown as removable bubbles inside one field.
 * Picking an option from the drop-down adds its bubble; "Nepoužiť" replaces all others.
 */
export function TypeTags({ value, onChange, label }: { value: SourceType[]; onChange: (v: SourceType[]) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle(t: SourceType) {
    if (value.includes(t)) onChange(value.filter((x) => x !== t));
    else if (t === "skip") {
      onChange(["skip"]);
      setOpen(false);
    } else onChange(cleanTypes([...value.filter((x) => x !== "skip"), t]));
  }

  const skip = value.includes("skip");

  return (
    <div ref={wrap} className="relative">
      <div
        className={cx(
          "min-h-12 w-full rounded-xl border-2 bg-card px-1.5 py-1.5 flex flex-wrap items-center gap-1.5 transition-colors",
          open ? "border-sky" : "border-line",
        )}
      >
        {value.map((t) => (
          <span
            key={t}
            className={cx(
              "inline-flex items-center gap-0.5 h-8 pl-3 pr-1 rounded-full text-sm font-bold anim-pop",
              t === "skip" ? "bg-paper text-slate border border-line" : "bg-sky-soft text-sky",
            )}
          >
            {sourceTypeLabel(t)}
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x !== t))}
              aria-label={`Odobrať ${sourceTypeLabel(t)}`}
              className="size-6 inline-flex items-center justify-center rounded-full hover:bg-ink/10"
            >
              <X className="size-3.5" />
            </button>
          </span>
        ))}
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={value.length ? `${label}: pridať typ` : label}
          onClick={() => {
            if (!open && wrap.current) {
              // open upwards when the list would end up under the sticky buttons at the bottom
              const r = wrap.current.getBoundingClientRect();
              const below = window.innerHeight - r.bottom;
              setUp(below < 470 && r.top > below);
            }
            setOpen(!open);
          }}
          className={cx(
            "h-8 inline-flex items-center gap-1 rounded-full px-2.5 text-sm font-bold text-slate hover:bg-paper",
            !value.length && "flex-1 justify-between text-mist font-semibold",
          )}
        >
          {value.length ? (skip ? "Zmeniť" : "Pridať") : "Vyber typ cvičenia"}
          <ChevronDown className={cx("size-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-multiselectable="true"
          aria-label={label}
          className={cx(
            "absolute z-30 left-0 right-0 rounded-2xl bg-card border border-line shadow-xl p-1.5 anim-rise",
            up ? "bottom-full mb-1.5" : "top-full mt-1.5",
          )}
        >
          {SOURCE_TYPES.map((t) => {
            const on = value.includes(t.value);
            return (
              <button
                key={t.value}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => toggle(t.value)}
                className={cx(
                  "w-full flex items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-paper",
                  t.value === "skip" && "mt-1 border-t border-line rounded-t-none pt-3",
                )}
              >
                <span
                  className={cx(
                    "mt-0.5 size-5 rounded-md border-2 flex items-center justify-center shrink-0",
                    on ? (t.value === "skip" ? "bg-slate border-slate text-white" : "bg-sky border-sky text-white") : "border-line",
                  )}
                >
                  {on && <Check className="size-3.5" />}
                </span>
                <span className="min-w-0">
                  <span className="block font-bold text-ink">{t.label}</span>
                  <span className="block text-sm text-slate leading-snug">{t.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
