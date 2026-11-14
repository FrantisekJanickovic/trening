"use client";

import { ArrowLeft, Check, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GuideButton, GUIDES, type GuideId } from "@/components/en/guides";
import Classic from "@/components/en/session/activities/Classic";
import Flashcards from "@/components/en/session/activities/Flashcards";
import Grammar from "@/components/en/session/activities/Grammar";
import Listening from "@/components/en/session/activities/Listening";
import Match from "@/components/en/session/activities/Match";
import Reading from "@/components/en/session/activities/Reading";
import Scramble from "@/components/en/session/activities/Scramble";
import Shadowing from "@/components/en/session/activities/Shadowing";
import Speed from "@/components/en/session/activities/Speed";
import Writing from "@/components/en/session/activities/Writing";
import { useSessionEngine } from "@/components/en/session/engine";
import { Progress } from "@/components/en/session/parts";
import { buildPlan, phrasesOf, stepKeys, type Plan, type PlanInput } from "@/components/en/session/plan";
import Summary, { type SummaryData } from "@/components/en/session/Summary";
import { Button, Card, cx, Spinner } from "@/components/ui";
import { loadConfig } from "@/lib/en/config";
import { getChild, listLessons, loadContent, loadProblems, loadProgress, loadReviewItems, todayISO, type LessonWithCounts } from "@/lib/en/data";
import { phrases } from "@/lib/en/phrases";
import { itemKey, orderLessons, pickReview, previousLessonIds, problemUpdates } from "@/lib/en/problems";
import { activityLabel, GRADES, gradeLabel, mergeSettings } from "@/lib/en/settings";
import { prefetch, speak, stopSpeaking, unlockAudio } from "@/lib/en/speech";
import { supabase } from "@/lib/supabase";
import { nowMs } from "@/lib/en/text";
import type { Child, ChildSettings, GlobalConfig, ItemProgress, ProblemItem } from "@/lib/en/types";

type Saved = { grade?: number; lessons?: Record<string, string[]> };
const STORE = (id: string) => `anglictina.trening.${id}`;

function loadSaved(id: string): Saved {
  try {
    return JSON.parse(localStorage.getItem(STORE(id)) ?? "{}") as Saved;
  } catch {
    return {};
  }
}

function storeSaved(id: string, s: Saved) {
  try {
    localStorage.setItem(STORE(id), JSON.stringify(s));
  } catch {}
}

/** What the end of a training needs to update the problem questions. */
export type ProblemContext = { existing: Map<string, ProblemItem>; config: GlobalConfig };

export default function SessionPage() {
  const params = useSearchParams();
  const childId = params.get("dieta") ?? "";
  const reviewMode = params.get("rezim") === "chyby";
  const router = useRouter();

  const [child, setChild] = useState<Child | null>(null);
  const [lessons, setLessons] = useState<LessonWithCounts[]>([]);
  const [progress, setProgress] = useState<Map<string, ItemProgress>>(new Map());
  const [openProblems, setOpenProblems] = useState(0);
  const [grade, setGrade] = useState<number | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [guide, setGuide] = useState<GuideId>("female");
  const [playing, setPlaying] = useState<GuideId | null>(null);
  const [phase, setPhase] = useState<"setup" | "preparing" | "run" | "summary">("setup");
  const [prep, setPrep] = useState({ done: 0, total: 0 });
  const [plan, setPlan] = useState<Plan | null>(null);
  const [problemCtx, setProblemCtx] = useState<ProblemContext | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const playRun = useRef(0);

  const baseSettings = useMemo(() => mergeSettings(child?.settings), [child]);
  const settings: ChildSettings = useMemo(() => ({ ...baseSettings, voice: guide }), [baseSettings, guide]);

  useEffect(() => {
    if (!childId) return;
    (async () => {
      const [c, l, p, open] = await Promise.all([getChild(childId), listLessons(), loadProgress(childId), loadProblems(childId, { openOnly: true })]);
      if (!c) {
        router.replace("/predmet");
        return;
      }
      const saved = loadSaved(childId);
      setChild(c);
      setLessons(l);
      setProgress(p);
      setOpenProblems(open.length);
      setGuide(mergeSettings(c.settings).voice);
      const g = saved.grade ?? c.grade;
      setGrade(g);
      setSelected(defaultSelection(l, g, saved));
    })();
  }, [childId, router]);

  function defaultSelection(all: LessonWithCounts[], g: number | null, saved: Saved) {
    if (!g) return [];
    const inGrade = all.filter((x) => x.grade === g);
    const kept = (saved.lessons?.[String(g)] ?? []).filter((id) => inGrade.some((x) => x.id === id));
    if (kept.length) return kept;
    return inGrade.length === 1 ? [inGrade[0].id] : [];
  }

  const gradeLessons = useMemo(() => orderLessons(lessons.filter((l) => l.grade === grade)), [lessons, grade]);

  function chooseGrade(g: number | null) {
    setGrade(g);
    setSelected(defaultSelection(lessons, g, loadSaved(childId)));
  }

  async function chooseGuide(id: GuideId) {
    unlockAudio();
    setGuide(id);
    const run = ++playRun.current;
    setPlaying(id);
    const voice = { gender: id, slow: baseSettings.slowSpeech };
    await speak(GUIDES[id].hello.en, "en", voice);
    if (run === playRun.current) await speak(GUIDES[id].hello.sk, "sk", voice);
    if (run === playRun.current) setPlaying(null);
  }

  async function start() {
    if (!child) return;
    unlockAudio();
    playRun.current++;
    stopSpeaking();
    setPlaying(null);
    setError(null);
    setPhase("preparing");
    try {
      const sb = supabase();
      if (grade) {
        const saved = loadSaved(child.id);
        storeSaved(child.id, { grade, lessons: { ...(saved.lessons ?? {}), [String(grade)]: selected } });
      }
      if (guide !== baseSettings.voice) {
        const next = { ...child.settings, voice: guide };
        sb.from("children")
          .update({ settings: next })
          .eq("id", child.id)
          .then(() => setChild({ ...child, settings: next }));
      }

      const config = await loadConfig();
      let input: PlanInput;
      let problems: ProblemItem[];
      if (reviewMode) {
        problems = await loadProblems(child.id, { openOnly: true });
        const worst = [...problems].sort((a, b) => b.wrong_count - a.wrong_count).slice(0, Math.max(settings.wordsPerSession, 20));
        const r = await loadReviewItems(worst);
        input = {
          vocab: r.vocab,
          grammar: r.grammar,
          texts: [],
          review: { vocab: [], grammar: [], sentences: r.sentences },
          settings: { ...settings, wordsPerSession: 0 },
          progress,
          lessonTitles: ["Opakovanie chýb"],
        };
      } else {
        const prev = config.reviewPrevious ? previousLessonIds(lessons, selected, config.previousLessons) : [];
        const [content, all] = await Promise.all([loadContent(selected), loadProblems(child.id, { lessonIds: [...selected, ...prev] })]);
        problems = all;
        const review = await loadReviewItems(
          pickReview(
            all.filter((p) => prev.includes(p.lesson_id)),
            config.previousMax,
          ),
        );
        input = {
          ...content,
          review,
          settings,
          progress,
          lessonTitles: orderLessons(lessons.filter((l) => selected.includes(l.id))).map((l) => l.title),
        };
      }

      const newPlan = buildPlan(input);
      if (!newPlan.steps.length) {
        setError(reviewMode ? "Nemáš žiadne chyby na opakovanie. Výborne!" : "V zvolených lekciách zatiaľ nie je nič na precvičenie.");
        setPhase("setup");
        return;
      }

      const { data: row, error: e } = await sb
        .from("sessions")
        .insert({
          child_id: child.id,
          lesson_ids: reviewMode ? [] : selected,
          config: { grade, guide, reviewMode, reviewCount: newPlan.reviewCount, steps: newPlan.steps.map((s) => s.key) },
        })
        .select("id")
        .single();
      if (e) throw e;

      // prepare every sound of the training so practice has no waiting
      const say = phrasesOf(newPlan);
      setPrep({ done: 0, total: say.length });
      await prefetch(say, { gender: guide, slow: settings.slowSpeech }, (done, total) => setPrep({ done, total }));

      setProblemCtx({ existing: new Map(problems.map((p) => [itemKey(p.item_type, p.item_id), p])), config });
      setPlan(newPlan);
      setSessionId(row.id as string);
      setStep(0);
      setStartedAt(nowMs());
      setPhase("run");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tréning sa nepodarilo pripraviť.");
      setPhase("setup");
    }
  }

  if (!child) return <Spinner />;

  if (phase === "run" && plan && sessionId)
    return (
      <Runner
        child={child}
        settings={settings}
        plan={plan}
        sessionId={sessionId}
        progress={progress}
        problemCtx={problemCtx}
        step={step}
        setStep={setStep}
        startedAt={startedAt}
        onFinish={(s) => {
          setSummary(s);
          setPhase("summary");
        }}
      />
    );

  if (phase === "summary" && summary) return <Summary data={summary} child={child} settings={settings} />;

  if (phase === "preparing")
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-6xl">{child.avatar}</div>
        <p className="text-xl font-black">Pripravujem tréning…</p>
        {prep.total > 0 && (
          <div className="w-full max-w-xs">
            <Progress value={prep.done} total={prep.total} />
            <p className="text-sm text-slate mt-2">
              Pripravujem hlas {prep.done} / {prep.total}
            </p>
          </div>
        )}
      </main>
    );

  const canStart = reviewMode ? openProblems > 0 : selected.length > 0;

  return (
    <main className="flex-1 w-full max-w-xl mx-auto px-4 pt-4 pb-6 flex flex-col gap-5">
      <header className="flex items-center gap-2">
        <Link href={`/predmet/anglictina?child=${child.id}`} className="size-10 inline-flex items-center justify-center rounded-xl hover:bg-ink/5" aria-label="Späť">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-2xl font-black flex-1">{reviewMode ? "Opakovanie chýb" : "Tréning"}</h1>
        <span className="text-3xl" aria-hidden>
          {child.avatar}
        </span>
      </header>

      {reviewMode ? (
        <Card className="p-5">
          <p className="font-bold">
            {openProblems === 0
              ? "Nemáš žiadne chyby na opakovanie. Výborne!"
              : openProblems === 1
                ? "Zopakujeme si 1 otázku, ktorá ti robila problém."
                : `Zopakujeme si ${openProblems} ${openProblems < 5 ? "otázky" : "otázok"}, ktoré ti robili problém.`}
          </p>
        </Card>
      ) : (
        <>
          <Card className="p-5">
            <label htmlFor="grade" className="block text-lg font-black mb-2">
              Trieda
            </label>
            <select
              id="grade"
              value={grade ?? ""}
              onChange={(e) => chooseGrade(e.target.value ? Number(e.target.value) : null)}
              className="w-full h-14 rounded-2xl border-2 border-line bg-card px-4 text-lg font-bold focus:border-sky outline-none"
            >
              <option value="">Vyber triedu</option>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {gradeLabel(g)}
                </option>
              ))}
            </select>
          </Card>

          {grade && (
            <section aria-labelledby="lessons-h" className="anim-rise">
              <div className="flex items-baseline justify-between mb-2">
                <h2 id="lessons-h" className="text-lg font-black">
                  Lekcie
                </h2>
                {gradeLessons.length > 1 && <span className="text-sm font-bold text-slate">Vyber jednu alebo viac</span>}
              </div>
              {gradeLessons.length === 0 ? (
                <Card className="p-5 text-slate">Pre {gradeLabel(grade)} zatiaľ nie sú žiadne lekcie. Popros rodiča, nech nejakú pridá.</Card>
              ) : (
                <div className="space-y-2">
                  {gradeLessons.map((l) => {
                    const on = selected.includes(l.id);
                    return (
                      <button
                        key={l.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setSelected(on ? selected.filter((x) => x !== l.id) : [...selected, l.id])}
                        className={cx(
                          "w-full flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-colors",
                          on ? "bg-sun-soft border-sun-deep" : "bg-card border-line",
                        )}
                      >
                        <span
                          className={cx(
                            "size-7 rounded-lg border-2 flex items-center justify-center shrink-0",
                            on ? "bg-ink border-ink text-white" : "border-line",
                          )}
                        >
                          {on && <Check className="size-4" />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block font-black truncate">{l.title}</span>
                          <span className="block text-sm text-slate">
                            {[
                              l.vocab && `${l.vocab} slovíčok`,
                              l.grammar && `${l.grammar} gramatika`,
                              l.writing && `${l.writing} viet`,
                              l.texts && `${l.texts} text`,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "Zatiaľ prázdna"}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </>
      )}

      <section aria-labelledby="guide-h">
        <h2 id="guide-h" className="text-lg font-black mb-2">
          Sprievodca
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {(["female", "male"] as const).map((id) => (
            <GuideButton key={id} id={id} selected={guide === id} playing={playing === id} onSelect={() => chooseGuide(id)} />
          ))}
        </div>
      </section>

      {error && <p className="rounded-xl bg-tomato-soft text-tomato px-3 py-2 font-semibold">{error}</p>}

      <div className="sticky bottom-0 mt-auto pt-3 bg-gradient-to-t from-paper via-paper to-paper/0 safe-bottom">
        <Button size="xl" variant="sun" onClick={start} disabled={!canStart}>
          Začať tréning
        </Button>
      </div>
    </main>
  );
}

export function Runner({
  child,
  settings,
  plan,
  sessionId,
  progress,
  problemCtx,
  step,
  setStep,
  startedAt,
  onFinish,
}: {
  child: Child;
  settings: ChildSettings;
  plan: Plan;
  /** null = demo mode, nothing is saved */
  sessionId: string | null;
  progress: Map<string, ItemProgress>;
  problemCtx: ProblemContext | null;
  step: number;
  setStep: (n: number) => void;
  startedAt: number;
  onFinish: (s: SummaryData) => void;
}) {
  const { ctx, bubble, stats, wrongItems, tallies, xp, totals, flush } = useSessionEngine({
    child,
    settings,
    oral: settings.answerMode === "oral",
    sessionId,
    progress,
    catalog: plan.catalog,
  });
  const finishing = useRef(false);
  const total = plan.steps.length;
  const current = plan.steps[step];

  useEffect(() => {
    if (settings.motivation) ctx.announce(phrases.start(child.name), true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = useCallback(async () => {
    if (finishing.current) return;
    finishing.current = true;
    stopSpeaking();
    await flush();
    const durationSec = Math.round((nowMs() - startedAt) / 1000);
    const activities = stepKeys(plan).map((k) => {
      const st = stats.current.get(k) ?? { total: 0, correct: 0 };
      return { key: k, label: activityLabel(k), total: st.total, correct: st.correct };
    });
    const problems = [...wrongItems.current.entries()].map(([key, e]) => ({
      key,
      label: e.label,
      say: e.type === "vocab" ? e.label.split(" – ")[0] : e.type === "sentence" ? e.label : null,
    }));
    const xpEarned = xp.current;
    const { total: t, correct: c } = totals.current;

    const today = todayISO();
    const yesterday = new Date(nowMs() - 86400000);
    const yISO = new Date(yesterday.getTime() - yesterday.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const streak = child.last_practice_date === today ? child.streak_days : child.last_practice_date === yISO ? child.streak_days + 1 : 1;

    let todayXp = xpEarned;
    let masteredNow = 0;
    if (sessionId) {
      const sb = supabase();
      if (problemCtx) {
        const rows = problemUpdates({
          tallies: [...tallies.current.values()],
          catalog: plan.catalog,
          existing: problemCtx.existing,
          childId: child.id,
          sessionId,
          config: problemCtx.config,
          now: new Date().toISOString(),
        });
        masteredNow = rows.filter((r) => r.mastered && !problemCtx.existing.get(itemKey(r.item_type, r.item_id))?.mastered).length;
        if (rows.length) await sb.from("problem_items").upsert(rows, { onConflict: "child_id,item_type,item_id" });
      }
      await Promise.all([
        sb
          .from("sessions")
          .update({
            ended_at: new Date().toISOString(),
            total: t,
            correct: c,
            xp_earned: xpEarned,
            summary: {
              durationSec,
              activities,
              problems: problems.map((p) => ({ label: p.label })),
              lessonTitles: plan.lessonTitles,
              reviewCount: plan.reviewCount,
              masteredNow,
            },
          })
          .eq("id", sessionId),
        sb
          .from("children")
          .update({ xp: child.xp + xpEarned, streak_days: streak, last_practice_date: today })
          .eq("id", child.id),
      ]);
      const { data: todays } = await sb.from("sessions").select("xp_earned").eq("child_id", child.id).gte("started_at", `${today}T00:00:00`);
      todayXp = (todays ?? []).reduce((a, r) => a + ((r.xp_earned as number) ?? 0), 0);
    }
    if (settings.motivation) ctx.announce(phrases.finish(child.name), true);
    onFinish({ durationSec, activities, problems, xpEarned, total: t, correct: c, streak, todayXp, masteredNow });
  }, [child, ctx, flush, stats, wrongItems, tallies, xp, totals, onFinish, plan, sessionId, problemCtx, settings.motivation, startedAt]);

  const next = useCallback(() => {
    const n = step + 1;
    if (n >= total) {
      finish();
      return;
    }
    if (total >= 4 && n === Math.floor(total / 2) && settings.motivation) ctx.announce(phrases.halfway(child.name), true);
    setStep(n);
  }, [step, total, finish, settings.motivation, ctx, child.name, setStep]);

  if (!current) return null;

  return (
    <main className="flex-1 w-full max-w-xl mx-auto px-4 pt-3 flex flex-col">
      <header className="flex items-center gap-2 mb-4">
        <button
          type="button"
          aria-label="Ukončiť tréning"
          className="size-10 inline-flex items-center justify-center rounded-xl hover:bg-ink/5 text-slate"
          onClick={() => {
            if (confirm("Ukončiť tréning? Doterajšie výsledky sa uložia.")) finish();
          }}
        >
          <X className="size-6" />
        </button>
        <div className="flex-1 text-center">
          <div className="font-black">{activityLabel(current.key)}</div>
          {total > 1 &&
            (total <= 14 ? (
              <div className="flex justify-center gap-1 mt-1" aria-label={`Časť ${step + 1} z ${total}`}>
                {plan.steps.map((s, i) => (
                  <span key={i} className={cx("h-1.5 rounded-full transition-all", i < step ? "w-3 bg-leaf" : i === step ? "w-5 bg-ink" : "w-3 bg-line")} />
                ))}
              </div>
            ) : (
              <div className="text-xs font-bold text-slate mt-0.5">
                Časť {step + 1} z {total}
              </div>
            ))}
        </div>
        <span className="size-10 inline-flex items-center justify-center text-2xl" aria-hidden>
          {child.avatar}
        </span>
      </header>

      <div className="relative h-0">
        {bubble && (
          <div
            key={bubble.id}
            role="status"
            className={cx(
              "absolute left-1/2 -translate-x-1/2 -top-1 z-10 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-black shadow-sm anim-pop",
              bubble.tone === "streak"
                ? "bg-sun text-ink"
                : bubble.tone === "reassure"
                  ? "bg-sky-soft text-sky"
                  : bubble.tone === "info"
                    ? "bg-ink text-white"
                    : "bg-leaf-soft text-leaf",
            )}
          >
            {bubble.text}
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col pt-6" key={`${current.key}-${step}`}>
        {current.key === "flashcards" && <Flashcards items={current.vocab} ctx={ctx} onDone={next} />}
        {current.key === "classic" && <Classic items={current.vocab} ctx={ctx} onDone={next} hintMode={settings.hintMode} />}
        {current.key === "match" && <Match items={current.vocab} ctx={ctx} onDone={next} />}
        {current.key === "scramble" && <Scramble items={current.vocab} ctx={ctx} onDone={next} />}
        {current.key === "dictation" && <Classic items={current.vocab} ctx={ctx} onDone={next} activity="dictation" hintMode="blanks" mode="dictation" />}
        {current.key === "speed" && <Speed items={current.vocab} pool={plan.pool} ctx={ctx} onDone={next} />}
        {current.key === "shadowing" && <Shadowing sentences={current.sentences} ctx={ctx} onDone={next} />}
        {current.key === "grammar" && <Grammar items={current.grammar} ctx={ctx} onDone={next} />}
        {current.key === "writing" && <Writing items={current.writing} ctx={ctx} onDone={next} />}
        {current.key === "reading" && <Reading texts={current.texts} ctx={ctx} onDone={next} />}
        {current.key === "listening" && <Listening sentences={current.sentences} ctx={ctx} onDone={next} />}
      </div>
    </main>
  );
}
