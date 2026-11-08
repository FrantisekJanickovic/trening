"use client";

import { ArrowLeft, Play } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Card, ErrorNote, Input, Spinner, cx } from "@/components/ui";
import { subjectDef, type SubjectSlug } from "@/data/subjects";
import { getChild, loadVerbs } from "@/lib/data";
import type { Child } from "@/lib/types";
import {
  ANSWER_MODES,
  DIRECTIONS,
  DRILLS,
  OPTION_COUNTS,
  canForms,
  canTranslate,
  emptySetup,
  rangeError,
  type Verb,
  type VerbSetup,
} from "@/lib/verbs";

const COUNTS = [10, 15, 20, 30, 40];
const key = (childId: string) => `trening.verbs.${childId}`;

/** Pred štartom si dieťa poskladá test: rozsah, smer, ako odpovedá a čo sa skúša. */
export default function VerbsSetupScreen() {
  const slug = String(useParams().slug) as SubjectSlug;
  const childId = useSearchParams().get("child") ?? "";
  const router = useRouter();
  const def = subjectDef(slug);

  const [child, setChild] = useState<Child | null>(null);
  const [verbs, setVerbs] = useState<Verb[] | null>(null);
  const [setup, setSetup] = useState<VerbSetup | null>(null);

  useEffect(() => {
    getChild(childId).then(setChild);
    loadVerbs()
      .then((v) => {
        const usable = v.filter((x) => x.enabled);
        setVerbs(usable);
        let base = emptySetup(usable.length);
        try {
          const saved = JSON.parse(localStorage.getItem(key(childId)) ?? "{}") as Partial<VerbSetup>;
          base = { ...base, ...saved, from: Number(saved.from) || 1, to: Number(saved.to) || base.to };
        } catch {
          /* prvé spustenie */
        }
        setSetup({ ...base, to: Math.min(base.to, usable.length) || 1 });
      })
      .catch(() => setVerbs([]));
  }, [childId]);

  if (!verbs || !setup) return <Spinner />;

  const total = verbs.length;
  const err = rangeError(setup.from, setup.to, total);
  const chosen = err ? [] : verbs.slice(setup.from - 1, setup.to);
  const ready =
    setup.drill === "preklad" ? chosen.filter(canTranslate) : setup.drill === "tvary" ? chosen.filter(canForms) : chosen.filter((v) => canTranslate(v) || canForms(v));
  const set = <K extends keyof VerbSetup>(k: K, v: VerbSetup[K]) => setSetup({ ...setup, [k]: v });

  function start() {
    if (err || !ready.length) return;
    try {
      localStorage.setItem(key(childId), JSON.stringify(setup));
    } catch {
      /* nevadí, nastavenie sa len nezapamätá */
    }
    const q = new URLSearchParams({
      child: childId,
      od: String(setup!.from),
      do: String(setup!.to),
      smer: setup!.direction,
      odpoved: setup!.answer,
      moznosti: String(setup!.options),
      typ: setup!.drill,
      pocet: String(setup!.count),
      t: Date.now().toString(36),
    });
    router.push(`/predmet/${slug}/trening?${q}`);
  }

  const pill = (on: boolean) =>
    cx("px-3 h-11 rounded-2xl text-sm font-black border-2 border-b-4 transition", on ? "bg-sun-soft border-sun-deep text-ink" : "bg-card border-line text-slate");

  return (
    <main className="flex-1 w-full max-w-xl mx-auto px-4 pt-4 pb-10 safe-bottom">
      <header className="flex items-center gap-2">
        <Link href={`/predmet?child=${childId}`} aria-label="Späť na predmety" className="size-9 inline-flex items-center justify-center rounded-xl text-slate hover:bg-ink/5">
          <ArrowLeft className="size-5" />
        </Link>
        <span className="text-2xl">{def?.icon}</span>
        <h1 className="text-xl font-black">{def?.name}</h1>
        {child && <span className="ml-auto text-2xl">{child.avatar}</span>}
      </header>

      {total === 0 ? (
        <Card className="p-6 text-center mt-6">
          <p className="font-bold">Zoznam slovies je zatiaľ prázdny.</p>
          <p className="text-sm text-slate mt-1">Poproś rodiča, nech nafotí stranu so slovesami.</p>
        </Card>
      ) : (
        <div className="space-y-6 mt-5">
          <section>
            <h2 className="text-lg font-black">Ktoré slovesá</h2>
            <p className="text-sm text-slate font-semibold mt-0.5">V zozname ich je {total}. Vyber si, od ktorého po ktoré.</p>
            <div className="flex flex-wrap items-end gap-3 mt-3">
              <label className="block">
                <span className="block text-sm font-bold text-ink-soft mb-1">Od</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={total}
                  value={String(setup.from)}
                  aria-label="Od ktorého slovesa"
                  onChange={(e) => set("from", Math.trunc(Number(e.target.value)) || 0)}
                  className="w-24 text-center tabular-nums"
                />
              </label>
              <label className="block">
                <span className="block text-sm font-bold text-ink-soft mb-1">Po</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={total}
                  value={String(setup.to)}
                  aria-label="Po ktoré sloveso"
                  onChange={(e) => set("to", Math.trunc(Number(e.target.value)) || 0)}
                  className="w-24 text-center tabular-nums"
                />
              </label>
              <Button variant="ghost" size="sm" onClick={() => setSetup({ ...setup, from: 1, to: total })}>
                Všetky
              </Button>
            </div>
            {err ? (
              <ErrorNote>{err}</ErrorNote>
            ) : (
              <p className="text-sm text-slate font-semibold mt-2">
                Vybratých {chosen.length} slovies{ready.length < chosen.length ? `, z toho použiteľných ${ready.length}` : ""}.
              </p>
            )}
          </section>

          <section>
            <h2 className="text-lg font-black mb-2">Čo sa skúša</h2>
            <div className="flex flex-wrap gap-2">
              {DRILLS.map((d) => (
                <button key={d.value} type="button" aria-pressed={setup.drill === d.value} onClick={() => set("drill", d.value)} className={pill(setup.drill === d.value)}>
                  {d.label}
                </button>
              ))}
            </div>
            <p className="text-sm text-slate font-semibold mt-1.5">{DRILLS.find((d) => d.value === setup.drill)?.hint}</p>
          </section>

          <section>
            <h2 className="text-lg font-black mb-2">Smer</h2>
            <div className="flex flex-wrap gap-2">
              {DIRECTIONS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  aria-pressed={setup.direction === d.value}
                  onClick={() => set("direction", d.value)}
                  className={pill(setup.direction === d.value)}
                >
                  {d.label}
                </button>
              ))}
            </div>
            {setup.drill !== "preklad" && <p className="text-sm text-slate font-semibold mt-1.5">Pri tvaroch sa podľa smeru ukáže zadanie, odpovedáš vždy po anglicky.</p>}
          </section>

          <section>
            <h2 className="text-lg font-black mb-2">Ako odpovedáš</h2>
            <div className="flex flex-wrap gap-2">
              {ANSWER_MODES.map((a) => (
                <button key={a.value} type="button" aria-pressed={setup.answer === a.value} onClick={() => set("answer", a.value)} className={pill(setup.answer === a.value)}>
                  {a.label}
                </button>
              ))}
            </div>
            <p className="text-sm text-slate font-semibold mt-1.5">{ANSWER_MODES.find((a) => a.value === setup.answer)?.hint}</p>
            {setup.answer === "vyber" && (
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="text-sm font-bold text-ink-soft">Koľko možností:</span>
                {OPTION_COUNTS.map((n) => (
                  <button key={n} type="button" aria-pressed={setup.options === n} onClick={() => set("options", n)} className={cx(pill(setup.options === n), "w-12 px-0 text-center")}>
                    {n}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-lg font-black mb-2">Koľko otázok</h2>
            <div className="flex flex-wrap gap-2">
              {COUNTS.map((n) => (
                <button key={n} type="button" aria-pressed={setup.count === n} onClick={() => set("count", n)} className={cx(pill(setup.count === n), "w-14 px-0 text-center")}>
                  {n}
                </button>
              ))}
            </div>
          </section>

          <Button size="xl" variant="sun" onClick={start} disabled={!!err || !ready.length}>
            <Play className="size-6" /> Začať tréning
          </Button>
          {!err && !ready.length && <p className="text-sm font-bold text-tomato text-center">Vo vybranom rozsahu nie je ani jedno sloveso s vyplnenými údajmi.</p>}
        </div>
      )}
    </main>
  );
}
