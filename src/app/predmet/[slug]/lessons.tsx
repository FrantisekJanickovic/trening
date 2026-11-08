"use client";

import { ArrowLeft, ChartNoAxesColumn, Images, Network, Play, Target } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MapDownloads } from "@/components/mindmap-view";
import { PagePicker } from "@/components/pages-picker";
import { Button, Card, Spinner, buttonClass, cx } from "@/components/ui";
import { subjectDef, type SubjectSlug } from "@/data/subjects";
import { loadConfig } from "@/lib/config";
import { getChild, loadExercises, loadFigures, loadLessons, loadMindmaps, loadProgress, loadSets, loadSourcesFor } from "@/lib/data";
import { ASPECTS } from "@/lib/exercises";
import { describePages, encodePages, filterByPages, pagesOf, type Selection } from "@/lib/pages";
import { COUNTS } from "@/lib/plan";
import type { Child, Exercise, ExerciseSet, LessonWithCounts, Mindmap, Progress, Source, SubjectConfig } from "@/lib/types";

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
  const [sources, setSources] = useState<Source[]>([]);
  const [maps, setMaps] = useState<Mindmap[]>([]);
  const [sets, setSets] = useState<ExerciseSet[]>([]);
  const [figureCount, setFigureCount] = useState(0);
  const [config, setConfig] = useState<SubjectConfig | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [pageSel, setPageSel] = useState<Selection>({});
  const [count, setCount] = useState(15);

  useEffect(() => {
    getChild(childId).then(setChild);
    (async () => {
      const [ls, cfg] = await Promise.all([loadLessons(slug), loadConfig(slug)]);
      const ready = ls.filter((l) => l.exercises > 0);
      setLessons(ready);
      setConfig(cfg);
      const ids = ready.map((l) => l.id);
      const [ex, src, mm, st, figs] = await Promise.all([
        loadExercises(ids, true),
        loadSourcesFor(ids),
        loadMindmaps(ids, true),
        loadSets(ids, true),
        loadFigures(ids),
      ]);
      setExercises(ex);
      setSources(src);
      setMaps(mm);
      setSets(st);
      setFigureCount(figs.length);
      setProgress(
        await loadProgress(
          childId,
          ex.map((e) => e.id),
        ),
      );
      try {
        const saved = JSON.parse(localStorage.getItem(key(childId, slug)) ?? "{}");
        const kept = Array.isArray(saved.lessons) ? saved.lessons.filter((id: string) => ready.some((l) => l.id === id)) : [];
        setPicked(kept.length ? kept : ready.length === 1 ? [ready[0].id] : []);
        if (COUNTS.includes(saved.count)) setCount(saved.count);
      } catch {
        if (ready.length === 1) setPicked([ready[0].id]);
      }
    })().catch(() => setLessons([]));
  }, [slug, childId]);

  /** Cvičenia zúžené na vybrané lekcie aj vybrané strany. */
  const inScope = useMemo(
    () =>
      filterByPages(
        exercises.filter((e) => picked.includes(e.lesson_id) && (!config || config.aspects[e.aspect] !== false)),
        sources,
        pageSel,
      ),
    [exercises, sources, picked, pageSel, config],
  );

  /** Čo rodič vypol — dieťa to má vedieť dopredu, nie sa to dohadovať. */
  const skipped = ASPECTS.filter((a) => config && config.aspects[a.key] === false);

  const open = useMemo(() => {
    const ids = new Set(progress.filter((p) => !p.mastered && p.wrong_count > 0).map((p) => p.exercise_id));
    return inScope.filter((e) => ids.has(e.id)).length;
  }, [progress, inScope]);

  const available = inScope.length;

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
    const pages = encodePages(picked, pageSel, sources);
    router.push(`/predmet/${slug}/trening?child=${childId}&lessons=${picked.join(",")}&pages=${pages}&count=${count}&mode=${mode}&t=${t}`);
  }

  const activeMaps = maps.filter((m) => lessons.some((l) => l.id === m.lesson_id));
  const activeSets = sets.filter((x) => lessons.some((l) => l.id === x.lesson_id));

  // token sa berie z kliknutia, nie z renderu, aby sa dal ten istý tréning spustiť znova
  function startSet(x: ExerciseSet, t: string) {
    router.push(`/predmet/${slug}/trening?child=${childId}&lessons=${x.lesson_id}&set=${x.id}&count=${COUNTS[COUNTS.length - 1]}&mode=normal&t=${t}`);
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
                      const lessonPages = pagesOf(sources, l.id);
                      return (
                        <div
                          key={l.id}
                          className={cx("rounded-2xl border-2 border-b-[5px] transition", on ? "bg-sun-soft border-sun-deep" : "bg-card border-line")}
                        >
                          <button
                            type="button"
                            aria-pressed={on}
                            onClick={() => toggle(l.id)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left"
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
                              <span className="block text-sm text-slate font-semibold">
                                {l.exercises} cvičení
                                {lessonPages.length > 1 ? ` · ${lessonPages.length} strán` : ""}
                              </span>
                            </span>
                          </button>
                          {on && lessonPages.length > 1 && (
                            <div className="px-4 pb-3 -mt-1 border-t border-sun-deep/30 pt-2.5">
                              <PagePicker
                                pages={lessonPages}
                                value={pageSel[l.id] ?? []}
                                onChange={(next) => setPageSel((cur) => ({ ...cur, [l.id]: next }))}
                                idPrefix={`l-${l.id}`}
                                label="Z ktorých strán"
                              />
                            </div>
                          )}
                        </div>
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
            {skipped.length > 0 && (
              <p className="mt-3 rounded-2xl bg-sky-soft text-sky px-3.5 py-2.5 text-sm font-bold">
                {skipped.map((a) => a.skip).join(" ")}
              </p>
            )}
            {picked.length > 0 && available < count && (
              <p className="text-sm text-slate font-semibold mt-2">Pre tento výber je pripravených {available} cvičení, tréning ich bude mať toľko.</p>
            )}
          </section>

          {activeSets.length > 0 && (
            <section className="mt-8">
              <h2 className="text-xl font-black flex items-center gap-2">
                <Target className="size-5 text-sun-deep" /> Pripravené sady
              </h2>
              <p className="text-sm text-slate font-semibold mt-1">Kratší tréning presne na to, čo sa skúša.</p>
              <div className="space-y-2 mt-3">
                {activeSets.map((x) => (
                  <Card key={x.id} className="p-3 flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-black truncate">{x.name}</p>
                      <p className="text-sm text-slate font-semibold">
                        {x.exercise_ids.length} cvičení · {lessons.find((l) => l.id === x.lesson_id)?.title ?? ""}
                      </p>
                    </div>
                    <Button variant="sun" onClick={() => startSet(x, Date.now().toString(36))}>
                      <Play className="size-4" /> Spustiť
                    </Button>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {figureCount > 0 && (
            <section className="mt-8">
              <Card className="p-4 flex flex-wrap items-center gap-3">
                <Images className="size-6 text-sky shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-black">Obrázky z učebnice</p>
                  <p className="text-sm text-slate font-semibold">{figureCount} obrázkov s vysvetlením. Len na pozeranie, nie je to test.</p>
                </div>
                <Link href={`/predmet/${slug}/galeria?child=${childId}`} className={buttonClass("outline", "md")}>
                  Otvoriť galériu
                </Link>
              </Card>
            </section>
          )}

          {activeMaps.length > 0 && (
            <section className="mt-8">
              <h2 className="text-xl font-black flex items-center gap-2">
                <Network className="size-5 text-sky" /> Myšlienkové mapy
              </h2>
              <p className="text-sm text-slate font-semibold mt-1">Stiahni si ich a vytlač — dobre sa z nich opakuje pred skúšaním.</p>
              <div className="space-y-2 mt-3">
                {activeMaps.map((m) => {
                  const lesson = lessons.find((l) => l.id === m.lesson_id);
                  const total = pagesOf(sources, m.lesson_id).length;
                  const caption = `${lesson?.title ?? ""} · ${describePages(m.pages, total)}`;
                  return (
                    <Card key={m.id} className="p-3">
                      <p className="font-black truncate">{m.title}</p>
                      <p className="text-sm text-slate font-semibold mb-2 truncate">{caption}</p>
                      <MapDownloads data={m.data} caption={caption} name={`${lesson?.title ?? "mapa"}-${m.title}`} size="md" />
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

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
