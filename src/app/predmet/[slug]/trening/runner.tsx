"use client";

import { ChevronRight, X } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PLAYERS } from "@/components/exercise/players";
import { Button, Card, ErrorNote, Spinner, cx } from "@/components/ui";
import { subjectDef, type SubjectSlug } from "@/data/subjects";
import { cheer } from "@/lib/cheer";
import { loadConfig } from "@/lib/config";
import { getChild, loadExercises, loadProgress, loadSourcesFor } from "@/lib/data";
import { explainOf, isCorrect, preview, solution, typeLabel, type Answer } from "@/lib/exercises";
import { decodePages, filterByPages } from "@/lib/pages";
import { buildPlan, COUNTS } from "@/lib/plan";
import { progressUpdates, type Tally } from "@/lib/progress";
import { playAnswer } from "@/lib/sounds";
import { supabase } from "@/lib/supabase";
import type { Child, Exercise, Progress, SubjectConfig } from "@/lib/types";
import { Summary, type SummaryData } from "./summary";

type Loaded = { child: Child; config: SubjectConfig; plan: Exercise[]; progress: Progress[]; lessonIds: string[] };

export default function Runner() {
  const slug = String(useParams().slug) as SubjectSlug;
  const params = useSearchParams();
  const childId = params.get("child") ?? "";
  const lessons = (params.get("lessons") ?? "").split(",").filter(Boolean);
  const count = COUNTS.includes(Number(params.get("count"))) ? Number(params.get("count")) : 15;
  const mode = params.get("mode") === "focus" ? "focus" : "normal";
  const pages = params.get("pages") ?? "";
  const sig = `${childId}|${lessons.join(",")}|${pages}|${count}|${mode}|${params.get("t") ?? ""}`;
  return <Session key={sig} slug={slug} childId={childId} lessonIds={lessons} pages={pages} count={count} mode={mode} />;
}

function Session({
  slug,
  childId,
  lessonIds,
  pages,
  count,
  mode,
}: {
  slug: SubjectSlug;
  childId: string;
  lessonIds: string[];
  pages: string;
  count: number;
  mode: "normal" | "focus";
}) {
  const router = useRouter();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState(0);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const home = `/predmet/${slug}?child=${childId}`;
  const key = lessonIds.join(",");

  useEffect(() => {
    let off = false;
    (async () => {
      const ids = key.split(",").filter(Boolean);
      const [child, config, exercises, sources] = await Promise.all([getChild(childId), loadConfig(slug), loadExercises(ids, true), loadSourcesFor(ids)]);
      if (!child) throw new Error("Profil sa nenašiel.");
      const inScope = filterByPages(exercises, sources, decodePages(pages, ids));
      const allowed = inScope.filter((e) => config.types[e.type]);
      const progress = await loadProgress(
        childId,
        allowed.map((e) => e.id),
      );
      const plan = buildPlan({ exercises: allowed, progress, count, focus: mode === "focus" });
      if (!plan.length) throw new Error(mode === "focus" ? "Nemáš žiadne chyby na opakovanie." : "Pre vybrané strany zatiaľ nie sú cvičenia.");
      if (!off) setData({ child, config, plan, progress, lessonIds: ids });
    })().catch((e) => setError(e instanceof Error ? e.message : "Tréning sa nepodarilo pripraviť."));
    return () => {
      off = true;
    };
  }, [slug, childId, key, pages, count, mode, run]);

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
  return <Training key={run} slug={slug} mode={mode} data={data} onFinish={setSummary} onExit={() => router.push(home)} />;
}

function Training({
  slug,
  mode,
  data,
  onFinish,
  onExit,
}: {
  slug: SubjectSlug;
  mode: "normal" | "focus";
  data: Loaded;
  onFinish: (s: SummaryData) => void;
  onExit: () => void;
}) {
  const { child, config, plan } = data;
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState<{ answer: Answer; correct: boolean } | null>(null);
  const [bubble, setBubble] = useState<string | null>(config.encouragement ? cheer.start(child.name) : null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const results = useRef(new Map<string, boolean>());
  const streak = useRef(0);
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = performance.now();
  }, []);

  const ex = plan[idx];
  const Player = PLAYERS[ex.type];
  const progressPct = Math.round((idx / plan.length) * 100);

  function submit(a: Answer) {
    if (answer) return;
    const ok = isCorrect(ex.type, ex.payload, a);
    results.current.set(ex.id, ok);
    setAnswer({ answer: a, correct: ok });
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
    if (idx + 1 >= plan.length) {
      void finish();
      return;
    }
    setIdx(idx + 1);
    setAnswer(null);
    if (config.encouragement) {
      if (idx + 2 === plan.length) setBubble(cheer.last(child.name));
      else if (idx + 1 === Math.floor(plan.length / 2)) setBubble(cheer.halfway(child.name));
      else setBubble(null);
    }
  }

  async function finish() {
    setSaving(true);
    setSaveError(null);
    try {
      const sb = supabase();
      const answered = [...results.current.entries()];
      const correct = answered.filter(([, ok]) => ok).length;
      const score = answered.length ? Math.round((correct / answered.length) * 100) : 0;
      const durationSec = Math.round((performance.now() - startedAt.current) / 1000);
      const byType: Record<string, { total: number; correct: number }> = {};
      const wrong: { id: string; concept: string; preview: string }[] = [];
      for (const [id, ok] of answered) {
        const e = plan.find((x) => x.id === id)!;
        const t = (byType[e.type] ??= { total: 0, correct: 0 });
        t.total++;
        if (ok) t.correct++;
        else wrong.push({ id, concept: e.concept, preview: preview(e.type, e.payload).slice(0, 120) });
      }
      const { data: ses, error } = await sb
        .from("tr_sessions")
        .insert({
          child_id: child.id,
          subject: slug,
          lesson_ids: data.lessonIds,
          mode,
          planned: answered.length,
          correct,
          score,
          duration_sec: durationSec,
          summary: { wrong, byType },
        })
        .select("id")
        .single();
      if (error) throw error;

      const existing = new Map(data.progress.map((p) => [p.exercise_id, p]));
      const tallies: Tally[] = answered.map(([id, ok]) => ({ exerciseId: id, wrong: ok ? 0 : 1, solid: ok ? 1 : 0 }));
      const rows = progressUpdates({ tallies, existing, childId: child.id, sessionId: ses.id, config, now: new Date().toISOString() });
      if (rows.length) {
        const { error: pe } = await sb.from("tr_progress").upsert(rows, { onConflict: "child_id,exercise_id" });
        if (pe) throw pe;
      }
      const masteredNow = rows.filter((r) => r.mastered && !existing.get(r.exercise_id)?.mastered).length;
      if (masteredNow) await sb.from("tr_sessions").update({ summary: { wrong, byType, masteredNow } }).eq("id", ses.id);

      if (config.notifyOnFinish) {
        const low = score < config.lowScore;
        await sb.from("tr_notifications").insert({
          child_id: child.id,
          subject: slug,
          session_id: ses.id,
          kind: low ? "low_score" : "session_done",
          title: `${child.name}: ${subjectDef(slug)?.name ?? slug} ${score} %`,
          body: `${correct} z ${answered.length} správne${wrong.length ? `, chyby: ${[...new Set(wrong.map((w) => w.concept).filter(Boolean))].slice(0, 4).join(", ")}` : ""}`,
          score,
        });
      }
      onFinish({ child, subject: slug, mode, score, correct, total: answered.length, wrong, byType, masteredNow, durationSec });
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

  const explain = explainOf(ex.type, ex.payload);

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
          aria-label={`Hotových ${idx} z ${plan.length} cvičení`}
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full bg-leaf rounded-full transition-[width] duration-300" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="text-sm font-black text-slate tabular-nums">
          {idx}/{plan.length}
        </span>
      </header>

      <div className="min-h-14 flex items-center gap-2 mt-3" aria-live="polite">
        {bubble && (
          <>
            <span className="text-4xl">{child.avatar}</span>
            <span
              key={bubble}
              className={cx(
                "anim-bounce rounded-2xl px-3.5 py-2.5 font-black text-base leading-snug",
                answer ? (answer.correct ? "bg-leaf-soft text-leaf" : "bg-sun-soft text-ink") : "bg-sky-soft text-ink",
              )}
            >
              {bubble}
            </span>
          </>
        )}
      </div>

      <p className="text-center text-sm font-bold text-mist mt-1">{typeLabel(ex.type)}</p>

      <div className="flex-1 flex flex-col gap-4 py-3">
        <Player key={ex.id} payload={ex.payload} done={!!answer} onSubmit={submit} />

        {answer && (
          <div className="space-y-3 anim-rise">
            {!answer.correct && (
              <Card className="px-4 py-3 border-2 border-tomato/40 bg-tomato-soft">
                <p className="text-base font-black text-tomato">Správne je: {solution(ex.type, ex.payload)}</p>
              </Card>
            )}
            {explain && <p className="text-base font-semibold text-slate text-center">{explain}</p>}
            <Button size="xl" variant={answer.correct ? "leaf" : "primary"} onClick={next} autoFocus>
              Ďalšie <ChevronRight className="size-6 -ml-1" />
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
