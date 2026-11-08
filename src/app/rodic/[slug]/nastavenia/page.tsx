"use client";

import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Card, ErrorNote, Segmented, Spinner, Toggle } from "@/components/ui";
import { isVerbSubject, subjectDef, type SubjectSlug } from "@/data/subjects";
import { DEFAULT_CONFIG, LIMITS, loadConfig, saveConfig } from "@/lib/config";
import { TYPES, YEARS_MODES, yearsModeDef } from "@/lib/exercises";
import type { SubjectConfig } from "@/lib/types";

function NumberBox({ value, onChange, limits, label }: { value: number; onChange: (n: number) => void; limits: readonly [number, number]; label: string }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={limits[0]}
      max={limits[1]}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-16 h-10 rounded-xl border-2 border-line bg-card px-2 text-center text-base font-black focus:border-sky outline-none"
    />
  );
}

export default function SubjectSettings() {
  const slug = String(useParams().slug) as SubjectSlug;
  const def = subjectDef(slug);
  const [cfg, setCfg] = useState<SubjectConfig | null>(null);
  const [saved, setSaved] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConfig(slug)
      .then(setCfg)
      .catch(() => setCfg(DEFAULT_CONFIG));
  }, [slug]);

  if (!cfg) return <Spinner />;
  // slovesá sa negenerujú ani neobsahujú letopočty — tie nastavenia by boli mŕtve
  const verbs = isVerbSubject(slug);
  const set = <K extends keyof SubjectConfig>(k: K, v: SubjectConfig[K]) => {
    setCfg({ ...cfg, [k]: v });
    setSaved(false);
  };
  const anyType = Object.values(cfg.types).some(Boolean);
  const nums = verbs ? (["lowScore"] as const) : (["generateCount", "masteryStreak", "lowScore"] as const);
  const invalid = (!anyType && !verbs) || nums.some((k) => !Number.isInteger(cfg[k]) || cfg[k] < LIMITS[k][0] || cfg[k] > LIMITS[k][1]);

  async function save() {
    if (!cfg) return;
    setBusy(true);
    setError(null);
    try {
      await saveConfig(slug, cfg);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Uloženie zlyhalo.");
    } finally {
      setBusy(false);
    }
  }

  const row = "flex flex-wrap items-center gap-2 text-sm font-semibold text-ink-soft";
  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <Link href={`/rodic/${slug}`} className="inline-flex items-center gap-1 text-sm font-bold text-slate">
        <ArrowLeft className="size-4" /> {def?.name ?? slug}
      </Link>
      <h1 className="text-2xl font-black">Nastavenia predmetu {def?.name}</h1>

      {verbs && (
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-black">Čo si volí dieťa</h2>
          <p className="text-sm text-slate mt-1">
            Pri slovesách si rozsah, smer prekladu, spôsob odpovedania aj počet otázok navolí dieťa pred štartom. Tu sa nastavuje len priebeh tréningu.
          </p>
        </Card>
      )}

      {!verbs && (
        <Card className="p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="text-lg font-black">Typy cvičení</h2>
            <p className="text-sm text-slate mt-0.5">Vypnutý typ sa negeneruje ani neobjaví v tréningu.</p>
          </div>
          {TYPES.map((t) => (
            <Toggle key={t.key} checked={cfg.types[t.key]} onChange={(v) => set("types", { ...cfg.types, [t.key]: v })} label={t.label} description={t.help} />
          ))}
          {!anyType && <ErrorNote>Aspoň jeden typ musí byť zapnutý.</ErrorNote>}
        </Card>
      )}

      {!verbs && (
        <Card className="p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="text-lg font-black">Letopočty</h2>
            <p className="text-sm text-slate mt-0.5">
              Keď učiteľ letopočty neskúša, vynechaj ich. Keď sa ich dieťa potrebuje dobiť, nechaj len ich. Cvičenia ostanú uložené tak či tak a dieťa dostane
              na obrazovke oznam, čo ho čaká.
            </p>
          </div>
          <Segmented value={cfg.years} onChange={(v) => set("years", v)} options={YEARS_MODES.map((m) => ({ value: m.value, label: m.label }))} />
          <p className="text-sm font-semibold text-slate">{yearsModeDef(cfg.years).hint}</p>
        </Card>
      )}

      <Card className="p-5 sm:p-6 space-y-5">
        <h2 className="text-lg font-black">Tréning</h2>
        {!verbs && (
          <div className={row}>
            <span className="font-bold text-ink">Z jedného materiálu vyrobiť</span>
            <NumberBox value={cfg.generateCount} onChange={(n) => set("generateCount", n)} limits={LIMITS.generateCount} label="Počet cvičení na generovanie" />
            <span>cvičení.</span>
          </div>
        )}
        {!verbs && (
          <div className={row}>
            <span className="font-bold text-ink">Cvičenie je zvládnuté</span>
            <span>po</span>
            <NumberBox
              value={cfg.masteryStreak}
              onChange={(n) => set("masteryStreak", n)}
              limits={LIMITS.masteryStreak}
              label="Počet správnych odpovedí na zvládnutie"
            />
            <span>správnych odpovediach za sebou.</span>
          </div>
        )}
        <Toggle checked={cfg.encouragement} onChange={(v) => set("encouragement", v)} label="Povzbudzovanie počas tréningu" />
        <Toggle checked={cfg.sounds} onChange={(v) => set("sounds", v)} label="Tiché zvuky pri odpovedi" />
        <Toggle
          checked={cfg.allowExit}
          onChange={(v) => set("allowExit", v)}
          label="Dieťa môže ukončiť tréning"
          description="Nedokončený tréning sa neuloží ani nevyhodnotí."
        />
      </Card>

      <Card className="p-5 sm:p-6 space-y-5">
        <h2 className="text-lg font-black">Správy pre rodiča</h2>
        <Toggle
          checked={cfg.notifyOnFinish}
          onChange={(v) => set("notifyOnFinish", v)}
          label="Po dokončení tréningu mi daj vedieť"
          description="Správa sa objaví v rodičovskej zóne pod Správy."
        />
        <div className={row}>
          <span className="font-bold text-ink">Označiť ako slabý výsledok</span>
          <span>pod</span>
          <NumberBox value={cfg.lowScore} onChange={(n) => set("lowScore", n)} limits={LIMITS.lowScore} label="Hranica slabého výsledku" />
          <span>%.</span>
        </div>
      </Card>

      {error && <ErrorNote>{error}</ErrorNote>}
      <Button onClick={save} loading={busy} disabled={saved || invalid} variant={saved ? "outline" : "primary"}>
        {saved ? (
          <>
            <Check className="size-4" /> Uložené
          </>
        ) : (
          "Uložiť nastavenia"
        )}
      </Button>
    </div>
  );
}
