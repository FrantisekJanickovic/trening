"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, ErrorNote } from "@/components/ui";
import { DEFAULT_CONFIG, LIMITS, loadConfig, saveConfig } from "@/lib/en/config";
import type { GlobalConfig } from "@/lib/en/types";

function NumberBox({
  value,
  onChange,
  limits,
  label,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  limits: readonly [number, number];
  label: string;
  disabled?: boolean;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={limits[0]}
      max={limits[1]}
      value={value}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-16 h-10 rounded-xl border-2 border-line bg-card px-2 text-center text-base font-black focus:border-sky outline-none disabled:opacity-50"
    />
  );
}

/** Global training settings of the family account. */
export function TrainingSettings() {
  const [cfg, setCfg] = useState<GlobalConfig | null>(null);
  const [saved, setSaved] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConfig()
      .then(setCfg)
      .catch(() => setCfg(DEFAULT_CONFIG));
  }, []);

  if (!cfg) return null;
  const set = <K extends keyof GlobalConfig>(k: K, v: GlobalConfig[K]) => {
    setCfg({ ...cfg, [k]: v });
    setSaved(false);
  };
  const invalid = (["previousLessons", "previousMax", "masteryStreak", "maxSavedPerSession"] as const).some(
    (k) => !Number.isInteger(cfg[k]) || cfg[k] < LIMITS[k][0] || cfg[k] > LIMITS[k][1],
  );

  async function save() {
    if (!cfg) return;
    setBusy(true);
    setError(null);
    try {
      await saveConfig(cfg);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Uloženie zlyhalo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5 sm:p-6 space-y-5">
      <div>
        <h2 className="text-lg font-black">Tréning</h2>
        <p className="text-sm text-slate mt-0.5">Platí pre všetky deti a všetky lekcie.</p>
      </div>

      <div className="space-y-2">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1 size-5 shrink-0 accent-[var(--color-ink)]"
            checked={cfg.reviewPrevious}
            onChange={(e) => set("reviewPrevious", e.target.checked)}
          />
          <span className="font-bold">Pridávať do tréningu najproblémovejšie otázky z predchádzajúcich lekcií</span>
        </label>
        <div className="flex flex-wrap items-center gap-2 pl-8 text-sm font-semibold text-ink-soft">
          <span>Z predchádzajúcich</span>
          <NumberBox
            value={cfg.previousLessons}
            onChange={(n) => set("previousLessons", n)}
            limits={LIMITS.previousLessons}
            label="Počet predchádzajúcich lekcií"
            disabled={!cfg.reviewPrevious}
          />
          <span>lekcií, najviac</span>
          <NumberBox
            value={cfg.previousMax}
            onChange={(n) => set("previousMax", n)}
            limits={LIMITS.previousMax}
            label="Najviac otázok z predchádzajúcich lekcií"
            disabled={!cfg.reviewPrevious}
          />
          <span>otázok na tréning.</span>
        </div>
        <p className="pl-8 text-xs text-slate">
          Predchádzajúce lekcie sú tie, ktoré sú v zozname lekcií danej triedy vyššie. Otázky sa vložia náhodne medzi ostatné cvičenia.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink-soft">
        <span className="font-bold text-ink">Otázka je zvládnutá</span>
        <span>po</span>
        <NumberBox
          value={cfg.masteryStreak}
          onChange={(n) => set("masteryStreak", n)}
          limits={LIMITS.masteryStreak}
          label="Počet správnych odpovedí na zvládnutie"
        />
        <span>tréningoch za sebou so správnou odpoveďou.</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink-soft">
        <span className="font-bold text-ink">Z jedného tréningu uložiť</span>
        <span>najviac</span>
        <NumberBox
          value={cfg.maxSavedPerSession}
          onChange={(n) => set("maxSavedPerSession", n)}
          limits={LIMITS.maxSavedPerSession}
          label="Najviac nových problémových otázok z tréningu"
        />
        <span>nových problémových otázok.</span>
      </div>

      {invalid && <ErrorNote>Skontroluj čísla: povolené sú celé čísla v rozsahu, napr. 1 až 10.</ErrorNote>}
      {error && <ErrorNote>{error}</ErrorNote>}
      <Button onClick={save} loading={busy} disabled={saved || invalid} variant={saved ? "outline" : "primary"}>
        {saved ? (
          <>
            <Check className="size-4" /> Uložené
          </>
        ) : (
          "Uložiť nastavenia tréningu"
        )}
      </Button>
    </Card>
  );
}
