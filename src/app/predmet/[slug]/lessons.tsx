"use client";

import { ArrowLeft, ChartNoAxesColumn, Target } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, Spinner, cx } from "@/components/ui";
import { subjectDef, type SubjectSlug } from "@/data/subjects";
import { loadConfig } from "@/lib/config";
import { getChild, loadExercises, loadLessons, loadProgress } from "@/lib/data";
import { COUNTS } from "@/lib/plan";
import type { Child, Exercise, LessonWithCounts, Progress } from "@/lib/types";

const key = (child: string, subject: string) => `trening.setup.${subject}.${child}`;

export default function LessonPicker() {
  const slug = String(useParams().slug) as SubjectSlug;
  const childId = useSearchParams().get("child") ?? "";
  const router = useRouter();
  const def = subjectDef(slug);
  const [child, setChild] = useState<Child | null | undefined>(undefined);
  const [lessons, setLessons] = useState<LessonWithCounts[] | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [count, setCount] = useState(15);

  useEffect(() => {
    getChild(childId).then(setChild);
    (async () => {
      const [ls, cfg] = await Promise.all([loadLessons(slug), loadConfig(slug)]);
      const ready = ls.filter((l) => l.exercises > 0);
      setLessons(ready);
      void cfg;
      const ex = await loadExercises(
        ready.map((l) => l.id),
        true,
      );
      setExercises(ex);
      setProgress(
        await loadProgress(
          childId,
          ex.map((e) => e.id),
        ),
      );
      try {
        const saved = JSON.parse(localStorage.getItem(key(childId, slug)) ?? "{}");
        const ids = Array.isArray(saved.lessons) ? saved.lessons.filter((id: string) => ready.some((l) => l.id === id)) : [];
        setPicked(ids.length ? ids : ready.length === 1 ? [ready[0].id] : []);
        if (COUNTS.includes(saved.count)) setCount(saved.count);
      } catch {
        if (ready.length === 1) setPicked([ready[0].id]);
      }
    })().catch(() => setLessons([]));
  }, [slug, childId]);

  const open = useMemo(() => {
    const ids = new Set(progress.filter((p) => !p.mastered && p.wrong_count > 0).map((p) => p.exercise_id));
    const inPicked = exercises.filter((e) => ids.has(e.id) && (picked.length === 0 || picked.includes(e.lesson_id)));
    return inPicked.length;
  }, [progress, exercises, picked]);

  const available = exercises.filter((e) => picked.includes(e.lesson_id)).length;

  if (child === undefined || !lessons) return <Spinner />;
  if (!child)
    return (
      <main className="p-6 text-center">
        <p className="font-bold">Profil sa nenašiel.</p>
        <Link href="/" className="text-sky font-bold">
          Späť
        </Link>
      </main>
    );

  const toggle = (id: string) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  function start(mode: "normal" | "focus") {
    try {
      localStorage.setItem(key(childId, slug), JSON.stringify({ lessons: picked, count }));
    } catch {}
    const t = Date.now().toString(36);
    router.push(`/predmet/${slug}/trening?child=${childId}&lessons=${picked.join(",")}&count=${count}&mode=${mode}&t=${t}`);
  }

  const byGrade = [...new Set(lessons.map((l) => l.grade ?? 0))].sort((a, b) => a - b);

  return (
    <main className="flex-1 w-full max-w-xl mx-auto px-4 pt-4 pb-40">
      <header className="flex items-center gap-2">
        <Link
          href={`/predmet?child=${childId}`}
          aria-label="Späť na výber predmetu"
          className="size-10 -ml-2 inline-flex items-center justify-center rounded-xl hover:bg-ink/5"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <span className="text-3xl">{def?.icon}</span>
        <span className="font-black text-xl">{def?.name}</span>
        <Link
          href={`/predmet/${slug}/vysledky?child=${childId}`}
          className="ml-auto inline-flex items-center gap-1.5 h-10 px-3 rounded-xl bg-card border border-line text-sm font-bold"
        >
          <ChartNoAxesColumn className="size-4" /> Výsledky
        </Link>
      </header>

      {lessons.length === 0 ? (
        <Card className="p-6 mt-6 text-center text-slate">Pre tento predmet zatiaľ nie sú cvičenia. Rodič ich pripraví z učebnice.</Card>
      ) : (
        <>
          <section aria-labelledby="lessons-h" className="mt-6">
            <h1 id="lessons-h" className="text-2xl font-black">
              Vyber lekcie
            </h1>
            {byGrade.map((g) => (
              <div key={g} className="mt-3">
                {byGrade.length > 1 && <h2 className="text-sm font-black text-slate mb-1">{g ? `${g}. trieda` : "Bez triedy"}</h2>}
                <div className="space-y-2">
                  {lessons
                    .filter((l) => (l.grade ?? 0) === g)
                    .map((l) => {
                      const on = picked.includes(l.id);
                      return (
                        <button
                          key={l.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggle(l.id)}
                          className={cx(
                            "w-full flex items-center gap-3 rounded-2xl border-2 border-b-[5px] px-4 py-3 text-left transition",
                            on ? "bg-sun-soft border-sun-deep" : "bg-card border-line",
                          )}
                        >
                          <span
                            className={cx(
                              "size-6 shrink-0 rounded-lg border-2 flex items-center justify-center text-xs font-black",
                              on ? "bg-ink border-ink text-white" : "border-line",
                            )}
                          >
                            {on ? "✓" : ""}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-black truncate">{l.title}</span>
                            <span className="block text-sm text-slate font-semibold">{l.exercises} cvičení</span>
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </section>

          <section className="mt-6">
            <label htmlFor="count" className="block font-black text-lg">
              Koľko otázok?
            </label>
            <select
              id="count"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="mt-2 w-full h-14 rounded-2xl border-2 border-line bg-card px-4 text-xl font-black focus:border-sky outline-none"
            >
              {COUNTS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {picked.length > 0 && available < count && (
              <p className="text-sm text-slate font-semibold mt-2">Pre vybrané lekcie je pripravených {available} cvičení, tréning ich bude mať toľko.</p>
            )}
          </section>

          <div className="fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-paper via-paper to-transparent pt-6 safe-bottom">
            <div className="max-w-xl mx-auto px-4 space-y-2">
              {open > 0 && (
                <Button size="lg" variant="outline" className="w-full" onClick={() => start("focus")}>
                  <Target className="size-5" /> Len to, čo mi nešlo ({open})
                </Button>
              )}
              <Button size="xl" variant="sun" disabled={!picked.length || available === 0} onClick={() => start("normal")}>
                Začať tréning
              </Button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
