"use client";

import { Sparkles } from "lucide-react";
import { Button, Textarea, cx } from "@/components/ui";

export const PROMPT_LIMIT = 200;

export type Preset = { key: string; label: string; fill?: string };

type Props = {
  presets: Preset[];
  value: string;
  onChange: (v: string) => void;
  /** "run" — predvoľba hneď spustí AI; "fill" — predvoľba len doplní text do poľa */
  mode?: "run" | "fill";
  onRun?: (action: string) => void;
  busy?: string | null;
  disabled?: boolean;
  label: string;
  hint?: string;
  placeholder?: string;
};

/**
 * Pokyn pre AI. Prednastavené prompty pokrývajú bežné prípady, voľný text je
 * na zvyšok — s limitom, nech sa z pokynu nestane druhá lekcia.
 */
export default function PromptBox({ presets, value, onChange, mode = "run", onRun, busy, disabled, label, hint, placeholder }: Props) {
  const left = PROMPT_LIMIT - value.length;
  const run = (key: string) => onRun?.(key);

  return (
    <div className="rounded-2xl border-2 border-sky/30 bg-sky-soft/40 p-3 space-y-2">
      <p className="text-sm font-black text-ink">{label}</p>
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <Button
            key={p.key}
            variant="outline"
            size="sm"
            loading={busy === p.key}
            disabled={disabled || (!!busy && busy !== p.key)}
            onClick={() => (mode === "fill" ? onChange((p.fill ?? p.label).slice(0, PROMPT_LIMIT)) : run(p.key))}
          >
            {busy === p.key ? null : <Sparkles className="size-3.5 text-sun-deep" />} {p.label}
          </Button>
        ))}
      </div>
      <p className={cx("text-xs font-bold text-right", left <= 20 ? "text-tomato" : "text-slate")} aria-live="polite">
        zostáva {left} z {PROMPT_LIMIT} znakov
      </p>
      <Textarea
        rows={2}
        value={value}
        maxLength={PROMPT_LIMIT}
        disabled={disabled}
        aria-label={`${label} — vlastný pokyn`}
        placeholder={placeholder ?? "napíš vlastný pokyn, napríklad: sprav podobné ako A3F7K2"}
        onChange={(e) => onChange(e.target.value.slice(0, PROMPT_LIMIT))}
        className="text-sm"
      />
      {mode === "run" && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" loading={busy === "volny"} disabled={disabled || !value.trim() || (!!busy && busy !== "volny")} onClick={() => run("volny")}>
            <Sparkles className="size-3.5" /> Spustiť pokyn
          </Button>
          {hint && <span className="text-xs font-semibold text-slate">{hint}</span>}
        </div>
      )}
      {mode === "fill" && hint && <p className="text-xs font-semibold text-slate">{hint}</p>}
    </div>
  );
}
