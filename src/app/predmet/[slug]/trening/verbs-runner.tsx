"use client";

import { ChevronRight, X } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { FontSize, fontScaleStyle, readFontStep, saveFontStep, type FontStep } from "@/components/font-size";
import { Button, Card, ErrorNote, Input, Spinner, cx } from "@/components/ui";
import { subjectDef, type SubjectSlug } from "@/data/subjects";
import { cheer } from "@/lib/cheer";
import { loadConfig } from "@/lib/config";
import { getChild, loadVerbs } from "@/lib/data";
import { playAnswer } from "@/lib/sounds";
import { supabase } from "@/lib/supabase";
import type { Child, SubjectConfig } from "@/lib/types";
import {
  ANSWER_MODES,
  DIRECTIONS,
  DRILLS,
  FIELD_LABEL,
  answerMatches,
  buildTasks,
  choicesFor,
  rangeError,
  variants,
  type AnswerMode,
  type Direction,
  type DrillKind,
  type Verb,
  type VerbSetup,
  type VerbTask,
} from "@/lib/verbs";
import { Summary, type SummaryData } from "./summary";

type Loaded = { child: Child; config: SubjectConfig; pool: Verb[]; tasks: VerbTask[] };
/** Odpoveď na jednu časť otázky: čo dieťa napísalo/vybralo a či to sedelo. */
type Part = { label: string; given: string; expected: string; ok: boolean };

const num = (v: string | null, d: number) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : d);

export default function VerbsRunner() {
  const slug = String(useParams().slug) as SubjectSlug;
  const p = useSearchParams();
  const childId = p.get("child") ?? "";
  const setup: VerbSetup = useMemo(
    () => ({
      from: num(p.get("od"), 1),
      to: num(p.get("do"), 20),
      direction: (["enu-sk", "sk-enu", "oboje"] as Direction[]).includes(p.get("smer") as Direction) ? (p.get("smer") as Direction) : "oboje",
      answer: (["pisanie", "vyber"] as AnswerMode[]).includes(p.get("odpoved") as AnswerMode) ? (p.get("odpoved") as AnswerMode) : "vyber",
      options: Math.min(6, Math.max(3, num(p.get("moznosti"), 4))),
      drill: (["preklad", "tvary", "oboje"] as DrillKind[]).includes(p.get("typ") as DrillKind) ? (p.get("typ") as DrillKind) : "oboje",
      count: Math.min(60, Math.max(1, num(p.get("pocet"), 15))),
    }),
    [p],
  );
  const sig = `${childId}|${setup.from}-${setup.to}|${setup.direction}|${setup.answer}|${setup.options}|${setup.drill}|${setup.count}|${p.get("t") ?? ""}`;
  return <Session key={sig} slug={slug} childId={childId} setup={setup} />;
}

function Session({ slug, childId, setup }: { slug: SubjectSlug; childId: string; setup: VerbSetup }) {
  const router = useRouter();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState(0);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const home = `/predmet/${slug}?child=${childId}`;

  useEffect(() => {
    let off = false;
    (async () => {
      const [child, config, all] = await Promise.all([getChild(childId), loadConfig(slug), loadVerbs()]);
      if (!child) throw new Error("Profil sa nenašiel.");
      const list = all.filter((v) => v.enabled);
      const bad = rangeError(setup.from, setup.to, list.length);
      if (bad) throw new Error(bad);
      const pool = list.slice(setup.from - 1, setup.to);
      const tasks = buildTasks(pool, setup);
      if (!tasks.length) throw new Error("Vo vybranom rozsahu nie je ani jedno sloveso s vyplnenými údajmi.");
      if (!off) setData({ child, config, pool, tasks });
    })().catch((e) => setError(e instanceof Error ? e.message : "Tréning sa nepodarilo pripraviť."));
    return () => {
      off = true;
    };
  }, [slug, childId, setup, run]);

  if (error)
    return (
      <main className="p-6 max-w-md mx-auto space-y-4">
        <ErrorNote>{error}</ErrorNote>
        <Button onClick={() => router.push(home)}>Späť</Button>
      </main>
    );
  if (summary)
    return (
      <Summary
        data={summary}
        onAgain={() => {
          setSummary(null);
          setData(null);
          setRun((r) => r + 1);
        }}
        onHome={() => router.push(home)}
      />
    );
  if (!data) return <Spinner label="Pripravujem tréning…" />;
  return <Training key={run} slug={slug} setup={setup} data={data} onFinish={setSummary} onExit={() => router.push(home)} />;
}

function Training({
  slug,
  setup,
  data,
  onFinish,
  onExit,
}: {
  slug: SubjectSlug;
  setup: VerbSetup;
  data: Loaded;
  onFinish: (s: SummaryData) => void;
  onExit: () => void;
}) {
  const { child, config, pool, tasks } = data;
  const [idx, setIdx] = useState(0);
  // odpovede si držíme po otázkach, nech sa pri prechode nemusia nulovať efektom
  const [typedBy, setTypedBy] = useState<Record<number, string[]>>({});
  const [chosenBy, setChosenBy] = useState<Record<number, (string | null)[]>>({});
  const [result, setResult] = useState<{ parts: Part[]; correct: boolean } | null>(null);
  const [bubble, setBubble] = useState<string | null>(config.encouragement ? cheer.start(child.name) : null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [font, setFontState] = useState<FontStep>(0);
  useEffect(() => setFontState(readFontStep()), []);
  const setFont = (s: FontStep) => {
    setFontState(s);
    saveFontStep(s);
  };
  const done = useRef<{ task: VerbTask; parts: Part[]; ok: boolean }[]>([]);
  const streak = useRef(0);
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = performance.now();
  }, []);

  const task = tasks[idx];

  /** Čo sa pri tejto otázke pýtame: jedna alebo dve časti, každá s vlastným stĺpcom. */
  const slots = useMemo(() => {
    if (task.kind === "preklad")
      return [
        {
          label: task.from === "enu" ? "Po slovensky" : "Po anglicky",
          expected: task.expected,
          field: (task.from === "enu" ? "sk" : "base") as "sk" | "base",
        },
      ];
    return task.fields.map((f) => ({ label: FIELD_LABEL[f], expected: task.verb[f], field: f }));
  }, [task]);

  /** Možnosti sa držia pevné po celú otázku, nech sa pri prekreslení nepreskladajú. */
  const choiceSets = useMemo(
    () => (setup.answer === "vyber" ? slots.map((s) => choicesFor(s.expected, pool.filter((v) => v.id !== task.verb.id), s.field, setup.options)) : []),
    [slots, pool, task.verb.id, setup.answer, setup.options],
  );

  const typed = typedBy[idx] ?? slots.map(() => "");
  const chosen = chosenBy[idx] ?? slots.map(() => null);
  const given = (i: number) => (setup.answer === "vyber" ? (chosen[i] ?? "") : (typed[i] ?? ""));
  const ready = slots.every((_, i) => given(i).trim().length > 0);
  const progressPct = Math.round((idx / tasks.length) * 100);

  function check() {
    if (result || !ready) return;
    const parts: Part[] = slots.map((s, i) => ({ label: s.label, given: given(i).trim(), expected: s.expected, ok: answerMatches(given(i), s.expected) }));
    const ok = parts.every((x) => x.ok);
    done.current.push({ task, parts, ok });
    setResult({ parts, correct: ok });
    if (config.sounds) playAnswer(ok);
    if (!config.encouragement) return setBubble(null);
    if (ok) {
      streak.current++;
      setBubble(cheer.streak(streak.current, child.name) ?? (Math.random() < 0.6 ? cheer.praise(child.name) : ""));
    } else {
      streak.current = 0;
      setBubble(cheer.reassure(child.name));
    }
  }

  function next() {
    if (idx + 1 >= tasks.length) {
      void finish();
      return;
    }
    setIdx(idx + 1);
    setResult(null);
    if (config.encouragement) {
      if (idx + 2 === tasks.length) setBubble(cheer.last(child.name));
      else if (idx + 1 === Math.floor(tasks.length / 2)) setBubble(cheer.halfway(child.name));
      else setBubble(null);
    }
  }

  async function finish() {
    setSaving(true);
    setSaveError(null);
    try {
      const sb = supabase();
      const answered = done.current;
      const correct = answered.filter((a) => a.ok).length;
      const score = answered.length ? Math.round((correct / answered.length) * 100) : 0;
      const durationSec = Math.round((performance.now() - startedAt.current) / 1000);
      const byType: Record<string, { total: number; correct: number }> = {};
      const wrong: { id: string; concept: string; preview: string }[] = [];
      for (const [i, a] of answered.entries()) {
        const label = a.task.kind === "preklad" ? "Preklad" : "Tvary";
        const t = (byType[label] ??= { total: 0, correct: 0 });
        t.total++;
        if (a.ok) t.correct++;
        else
          wrong.push({
            id: `${i}-${a.task.verb.id}`,
            concept: a.task.verb.base,
            preview: a.parts.map((p) => `${p.label.toLocaleLowerCase("sk")}: ${variants(p.expected)[0] ?? p.expected}`).join(" · ").slice(0, 160),
          });
      }
      const { data: ses, error } = await sb
        .from("tr_sessions")
        .insert({
          child_id: child.id,
          subject: slug,
          mode: "normal",
          planned: answered.length,
          correct,
          score,
          duration_sec: durationSec,
          summary: { wrong, byType, verbs: { from: setup.from, to: setup.to, direction: setup.direction, answer: setup.answer, drill: setup.drill } },
        })
        .select("id")
        .single();
      if (error) throw error;

      if (config.notifyOnFinish) {
        const low = score < config.lowScore;
        await sb.from("tr_notifications").insert({
          child_id: child.id,
          subject: slug,
          session_id: ses.id,
          kind: low ? "low_score" : "session_done",
          title: `${child.name}: ${subjectDef(slug)?.name ?? slug} ${score} %`,
          body: `${correct} z ${answered.length} správne, slovesá ${setup.from}–${setup.to}${wrong.length ? `, chyby: ${[...new Set(wrong.map((w) => w.concept))].slice(0, 4).join(", ")}` : ""}`,
          score,
        });
      }
      onFinish({ child, subject: slug, mode: "normal", score, correct, total: answered.length, wrong, byType, masteredNow: 0, durationSec });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Uloženie zlyhalo.");
      setSaving(false);
    }
  }

  if (saving || saveError)
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
        {saveError ? (
          <>
            <ErrorNote>Výsledok sa nepodarilo uložiť: {saveError}</ErrorNote>
            <Button onClick={() => void finish()}>Skúsiť znova</Button>
          </>
        ) : (
          <Spinner label="Ukladám výsledok…" />
        )}
      </main>
    );

  const askLang = task.from === "enu" ? "anglicky" : "slovensky";

  return (
    <main className="flex-1 flex flex-col w-full max-w-xl mx-auto px-4 pt-3 pb-6 safe-bottom">
      <header className="flex items-center gap-3">
        {config.allowExit && (
          <button
            type="button"
            aria-label="Ukončiť tréning"
            onClick={() => {
              if (window.confirm("Ukončiť tréning? Výsledok sa neuloží ani nevyhodnotí.")) onExit();
            }}
            className="size-8 -ml-1 shrink-0 inline-flex items-center justify-center rounded-lg text-mist hover:text-ink hover:bg-ink/5"
          >
            <X className="size-4" />
          </button>
        )}
        <div
          className="flex-1 h-4 rounded-full bg-line overflow-hidden"
          role="progressbar"
          aria-label={`Hotových ${idx} z ${tasks.length} otázok`}
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full bg-leaf rounded-full transition-[width] duration-300" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="text-sm font-black text-slate tabular-nums">
          {idx}/{tasks.length}
        </span>
        <FontSize step={font} onChange={setFont} />
      </header>

      <div className="min-h-14 flex items-center gap-2 mt-3" aria-live="polite">
        {bubble && (
          <>
            <span className="text-4xl">{child.avatar}</span>
            <span
              key={bubble}
              className={cx(
                "anim-bounce rounded-2xl px-3.5 py-2.5 font-black text-base leading-snug",
                result ? (result.correct ? "bg-leaf-soft text-leaf" : "bg-sun-soft text-ink") : "bg-sky-soft text-ink",
              )}
            >
              {bubble}
            </span>
          </>
        )}
      </div>

      <p className="text-center text-sm font-bold text-mist mt-1">{task.kind === "preklad" ? "Preklad" : "Tvary slovesa"}</p>

      <div className="flex-1 flex flex-col gap-4 py-3 ex-zoom" style={fontScaleStyle(font)}>
        <Card className="p-5 text-center">
          <p className="text-sm font-bold text-slate">Sloveso {askLang}</p>
          <p className="text-3xl font-black mt-1 leading-tight break-words">{task.ask}</p>
        </Card>

        <div className="space-y-4">
          {slots.map((s, i) => (
            <div key={`${s.field}-${i}`}>
              <p className="text-sm font-black text-ink-soft mb-1.5">{s.label}</p>
              {setup.answer === "pisanie" ? (
                <Input
                  value={typed[i] ?? ""}
                  autoFocus={i === 0}
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={!!result}
                  aria-label={s.label}
                  placeholder="napíš odpoveď"
                  onChange={(e) => setTypedBy((t) => ({ ...t, [idx]: typed.map((x, j) => (j === i ? e.target.value : x)) }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && ready) check();
                  }}
                  className={cx(result && (result.parts[i]?.ok ? "border-leaf" : "border-tomato"))}
                />
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {choiceSets[i]?.map((opt) => {
                    const picked = chosen[i] === opt;
                    const isRight = !!result && answerMatches(opt, s.expected);
                    return (
                      <button
                        key={opt}
                        type="button"
                        disabled={!!result}
                        aria-pressed={picked}
                        onClick={() => setChosenBy((c) => ({ ...c, [idx]: chosen.map((x, j) => (j === i ? opt : x)) }))}
                        className={cx(
                          "min-h-12 px-3 py-2 rounded-2xl border-2 border-b-4 font-bold text-left transition disabled:opacity-100",
                          result
                            ? isRight
                              ? "bg-leaf-soft border-leaf text-leaf"
                              : picked
                                ? "bg-tomato-soft border-tomato text-tomato"
                                : "bg-card border-line text-mist"
                            : picked
                              ? "bg-sky-soft border-sky text-ink"
                              : "bg-card border-line text-ink hover:border-mist",
                        )}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {!result ? (
          <Button size="xl" variant="sun" onClick={check} disabled={!ready}>
            Skontrolovať
          </Button>
        ) : (
          <div className="space-y-3 anim-rise">
            {!result.correct && (
              <Card className="px-4 py-3 border-2 border-tomato/40 bg-tomato-soft">
                <p className="text-sm font-black text-tomato uppercase tracking-wide">Správne je</p>
                <ul className="mt-1 space-y-1">
                  {result.parts
                    .filter((x) => !x.ok)
                    .map((x, i) => (
                      <li key={i} className="text-base font-black text-tomato leading-snug">
                        {x.label}: {x.expected}
                      </li>
                    ))}
                </ul>
              </Card>
            )}
            {task.kind === "tvary" && (
              <p className="text-base font-semibold text-slate text-center">
                {task.verb.base} – {task.verb.past} – {task.verb.participle}
                {task.verb.sk ? ` (${task.verb.sk})` : ""}
              </p>
            )}
            <Button size="xl" variant={result.correct ? "leaf" : "primary"} onClick={next} autoFocus>
              Ďalšie <ChevronRight className="size-6 -ml-1" />
            </Button>
          </div>
        )}

        <p className="text-center text-xs font-bold text-mist">
          Slovesá {setup.from}–{setup.to} · {DRILLS.find((d) => d.value === setup.drill)?.label} · {DIRECTIONS.find((d) => d.value === setup.direction)?.label} ·{" "}
          {ANSWER_MODES.find((a) => a.value === setup.answer)?.label}
        </p>
      </div>
    </main>
  );
}
