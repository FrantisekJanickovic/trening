"use client";

import { ArrowLeft, Camera, Loader2, Sparkles, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, ErrorNote, Field, Input, Segmented, Spinner, Textarea, cx } from "@/components/ui";
import { GRADES, gradeLabel, subjectDef, type SubjectSlug } from "@/data/subjects";
import { aiInfo, generateExercises, toJpegBase64, transcribe } from "@/lib/ai";
import { DEFAULT_CONFIG, loadConfig } from "@/lib/config";
import { getLesson, loadExercises, loadSources } from "@/lib/data";
import { runFactcheck } from "@/lib/factcheck";
import { cropFigures, saveFigures } from "@/lib/figures";
import { TYPES, preview } from "@/lib/exercises";
import { supabase } from "@/lib/supabase";
import type { Exercise, Lesson, Source, SubjectConfig } from "@/lib/types";
import ExercisesTab from "./exercises-tab";
import Gallery from "./gallery";
import Mindmaps from "./mindmaps";

type Queue = { key: string; name: string; state: "waiting" | "reading" | "done" | "error"; note?: string };
const LAST_GRADE = "trening.lastGrade";

export default function LessonEditor() {
  const slug = String(useParams().slug) as SubjectSlug;
  const lessonId = useSearchParams().get("id");
  const router = useRouter();
  const def = subjectDef(slug);
  const fileRef = useRef<HTMLInputElement>(null);

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [title, setTitle] = useState("");
  const [grade, setGrade] = useState<number | "">("");
  const [sources, setSources] = useState<Source[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [config, setConfig] = useState<SubjectConfig>(DEFAULT_CONFIG);
  const [ai, setAi] = useState(true);
  const [tab, setTab] = useState<"material" | "exercises" | "maps" | "gallery">("material");
  const [queue, setQueue] = useState<Queue[]>([]);
  const [busy, setBusy] = useState<"save" | "generate" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [count, setCount] = useState(20);
  const [fromSources, setFromSources] = useState<string[]>([]);
  const [figureCount, setFigureCount] = useState(0);
  const [loaded, setLoaded] = useState(!lessonId);

  const reload = useCallback(async (id: string) => {
    const [s, e] = await Promise.all([loadSources(id), loadExercises([id])]);
    setSources(s);
    setExercises(e);
  }, []);

  useEffect(() => {
    aiInfo().then((i) => setAi(i.ai));
    loadConfig(slug).then((c) => {
      setConfig(c);
      setCount(c.generateCount);
    });
    try {
      const g = Number(localStorage.getItem(LAST_GRADE));
      if (GRADES.includes(g)) setGrade(g);
    } catch {}
    if (!lessonId) return;
    getLesson(lessonId).then((l) => {
      if (l) {
        setLesson(l);
        setTitle(l.title);
        setGrade(l.grade ?? "");
      }
      setLoaded(true);
    });
    void reload(lessonId);
  }, [lessonId, slug, reload]);

  /** Vytvorí lekciu, keď ešte neexistuje, aby sa dali ukladať časti materiálu. */
  async function ensureLesson(): Promise<Lesson> {
    if (lesson) return lesson;
    const t = title.trim() || "Nová lekcia";
    const { data, error } = await supabase()
      .from("tr_lessons")
      .insert({ subject: slug, title: t, grade: grade === "" ? null : grade })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    const l = data as Lesson;
    setLesson(l);
    setTitle(l.title);
    router.replace(`/rodic/${slug}/lekcia?id=${l.id}`);
    return l;
  }

  async function save() {
    setBusy("save");
    setError(null);
    try {
      const l = await ensureLesson();
      const patch = { title: title.trim() || "Nová lekcia", grade: grade === "" ? null : grade, updated_at: new Date().toISOString() };
      const { error } = await supabase().from("tr_lessons").update(patch).eq("id", l.id);
      if (error) throw new Error(error.message);
      setLesson({ ...l, ...patch, grade: patch.grade });
      if (grade !== "") localStorage.setItem(LAST_GRADE, String(grade));
      setInfo("Lekcia je uložená.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Uloženie zlyhalo.");
    } finally {
      setBusy(null);
    }
  }

  /** Nafotené strany: každú prepíše AI a uloží ako časti materiálu. */
  async function addPhotos(files: File[]) {
    if (!files.length) return;
    setError(null);
    setInfo(null);
    const items: Queue[] = files.map((f, i) => ({ key: `${Date.now()}-${i}`, name: f.name, state: "waiting" }));
    setQueue((q) => [...q, ...items]);
    let lessonRow: Lesson;
    try {
      lessonRow = await ensureLesson();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lekciu sa nepodarilo založiť.");
      setQueue([]);
      return;
    }
    let page = Math.max(0, ...sources.map((s) => s.page)) + 1;
    for (let i = 0; i < files.length; i++) {
      const item = items[i];
      setQueue((q) => q.map((x) => (x.key === item.key ? { ...x, state: "reading" } : x)));
      try {
        const img = await toJpegBase64(files[i]);
        const t = await transcribe(img, slug, lessonRow.grade);
        if (!t.sections.length) throw new Error("Zo strany sa nepodarilo nič prečítať.");
        const base = Math.max(0, ...sources.map((s) => s.position), -1) + 1;
        const rows = t.sections.map((s, j) => ({ lesson_id: lessonRow.id, page, heading: s.heading || null, text: s.text, position: base + i * 100 + j }));
        const { data: inserted, error } = await supabase().from("tr_sources").insert(rows).select("id");
        if (error) throw new Error(error.message);

        // obrázky zo strany idú do galérie; keď sa to nepodarí, prepis textu tým netrpí
        let figNote = "";
        try {
          const crops = await cropFigures(files[i], t.figures ?? []);
          if (crops.length) {
            const n = await saveFigures(lessonRow.id, (inserted ?? [])[0]?.id ?? null, page, crops, Date.now());
            setFigureCount((c) => c + n);
            figNote = `, ${n} obrázkov`;
          }
        } catch {
          figNote = ", obrázky sa nepodarilo uložiť";
        }
        if (!lessonRow.title || lessonRow.title === "Nová lekcia") {
          if (t.title) {
            await supabase().from("tr_lessons").update({ title: t.title }).eq("id", lessonRow.id);
            lessonRow = { ...lessonRow, title: t.title };
            setLesson(lessonRow);
            setTitle(t.title);
          }
        }
        page++;
        setQueue((q) => q.map((x) => (x.key === item.key ? { ...x, state: "done", note: `${t.sections.length} častí${figNote}` } : x)));
        await reload(lessonRow.id);
      } catch (e) {
        setQueue((q) => q.map((x) => (x.key === item.key ? { ...x, state: "error", note: e instanceof Error ? e.message : "Chyba" } : x)));
      }
    }
  }

  async function generate() {
    if (!lesson) return;
    setBusy("generate");
    setError(null);
    setInfo(null);
    try {
      const types = TYPES.filter((t) => config.types[t.key]).map((t) => t.key);
      // keď si rodič vybral len niektoré časti, cvičenia vzniknú iba z nich
      const used = fromSources.length ? sources.filter((s) => fromSources.includes(s.id)) : sources;
      const r = await generateExercises({
        subject: slug,
        grade: lesson.grade,
        title: lesson.title,
        sections: used.map((s) => ({ heading: s.heading ?? "", text: s.text })),
        types,
        count,
        avoid: exercises.map((e) => preview(e.type, e.payload).slice(0, 120)),
      });
      const rows = r.exercises.map((x, i) => ({
        lesson_id: lesson.id,
        type: x.type,
        payload: x.payload,
        concept: x.concept,
        level: x.level,
        aspect: x.aspect,
        source_id: x.source !== null ? (used[x.source]?.id ?? null) : null,
        position: Date.now() + i,
      }));
      const { data: made, error } = await supabase().from("tr_exercises").insert(rows).select("*");
      if (error) throw new Error(error.message);
      await reload(lesson.id);
      setTab("exercises");
      setInfo(`Vytvorených ${rows.length} cvičení.${rows.length < count ? ` Z ${count} žiadaných bolo zvyšok nepoužiteľných.` : ""} Spúšťam kontrolu…`);

      // hneď po vygenerovaní ich dá appka skontrolovať druhým volaním AI
      try {
        const check = await runFactcheck({ slug, lesson, sources: used, exercises: (made ?? []) as Exercise[] });
        await reload(lesson.id);
        setInfo(
          `Vytvorených ${rows.length} cvičení. Kontrola: ${check.checked} v poriadku` +
            (check.problems ? `, ${check.problems} s výhradou — pozri poznámky pri cvičeniach.` : "."),
        );
      } catch {
        setInfo(`Vytvorených ${rows.length} cvičení. Automatická kontrola zlyhala, spusti ju tlačidlom „Skontrolovať neoznačené“.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generovanie zlyhalo.");
    } finally {
      setBusy(null);
    }
  }

  async function saveSource(s: Source, text: string) {
    await supabase().from("tr_sources").update({ text }).eq("id", s.id);
    setSources((cur) => cur.map((x) => (x.id === s.id ? { ...x, text } : x)));
  }

  async function removeSource(s: Source) {
    if (!window.confirm("Zmazať túto časť materiálu?")) return;
    await supabase().from("tr_sources").delete().eq("id", s.id);
    if (lesson) await reload(lesson.id);
  }

  async function removeLesson() {
    if (!lesson || !window.confirm(`Zmazať lekciu „${lesson.title}“ aj so všetkými cvičeniami?`)) return;
    await supabase().from("tr_lessons").delete().eq("id", lesson.id);
    router.push(`/rodic/${slug}`);
  }

  if (!loaded) return <Spinner />;

  const working = queue.some((q) => q.state === "reading" || q.state === "waiting");

  return (
    <div className="space-y-5 max-w-3xl">
      <Link href={`/rodic/${slug}`} className="inline-flex items-center gap-1 text-sm font-bold text-slate">
        <ArrowLeft className="size-4" /> {def?.name ?? slug}
      </Link>

      <Card className="p-5 space-y-4">
        <h1 className="text-2xl font-black">{lesson ? "Upraviť lekciu" : "Nová lekcia"}</h1>
        <Field label="Názov lekcie">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="napr. Veľká Morava" maxLength={160} />
        </Field>
        <Field label="Trieda" hint="Dieťa uvidí lekciu pod touto triedou.">
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value === "" ? "" : Number(e.target.value))}
            aria-label="Trieda"
            className="w-full h-11 rounded-xl border-2 border-line bg-card px-3 font-semibold"
          >
            <option value="">Vyber triedu</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {gradeLabel(g)}
              </option>
            ))}
          </select>
        </Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        {info && <p className="rounded-xl bg-leaf-soft text-leaf px-3 py-2 text-sm font-semibold">{info}</p>}
        <div className="flex flex-wrap gap-2">
          <Button onClick={save} loading={busy === "save"}>
            Uložiť lekciu
          </Button>
          {lesson && (
            <Button variant="danger" onClick={removeLesson}>
              <Trash2 className="size-4" /> Zmazať lekciu
            </Button>
          )}
        </div>
      </Card>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "material", label: `Materiál (${sources.length})` },
          { value: "exercises", label: `Cvičenia (${exercises.length})` },
          ...(lesson ? [{ value: "maps" as const, label: "Mapy a osi" }, { value: "gallery" as const, label: "Galéria" }] : []),
        ]}
      />

      {tab === "maps" && lesson ? (
        <Card className="p-4 sm:p-5">
          <Mindmaps lesson={lesson} sources={sources} slug={slug} ai={ai} />
        </Card>
      ) : tab === "gallery" && lesson ? (
        <Card className="p-4 sm:p-5">
          <Gallery lesson={lesson} key={figureCount} />
        </Card>
      ) : tab === "material" ? (
        <Card className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 max-w-prose">
              <h2 className="text-lg font-black">Strany z učebnice</h2>
              <p className="text-sm text-slate mt-0.5">Nafoť alebo vyber strany lekcie. Appka text prepíše a rozdelí na časti, ktoré si môžeš opraviť.</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addPhotos(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
            <Button variant="sun" onClick={() => fileRef.current?.click()} disabled={!ai || working}>
              <Camera className="size-4" /> {sources.length ? "Pridať strany" : "Vybrať fotky"}
            </Button>
          </div>
          {!ai && (
            <p className="text-sm text-slate rounded-xl bg-paper px-3 py-2">
              Čítanie fotiek sa zapne po nastavení kľúča <code className="font-mono text-xs">OPENAI_API_KEY</code> vo Verceli. Časti materiálu môžeš zatiaľ
              písať ručne.
            </p>
          )}
          {queue.length > 0 && (
            <ul className="grid gap-2 sm:grid-cols-2" aria-live="polite">
              {queue.map((q) => (
                <li key={q.key} className="flex items-center gap-2 rounded-2xl border border-line p-2 text-sm">
                  {q.state === "reading" ? (
                    <Loader2 className="size-4 animate-spin text-sky" />
                  ) : q.state === "error" ? (
                    <X className="size-4 text-tomato" />
                  ) : (
                    <Camera className="size-4 text-mist" />
                  )}
                  <span className="truncate flex-1">{q.name}</span>
                  <span className={cx("font-bold", q.state === "error" ? "text-tomato" : "text-slate")}>
                    {q.note ?? (q.state === "reading" ? "čítam…" : q.state === "waiting" ? "čaká" : "hotovo")}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-3">
            {sources.map((s) => (
              <div key={s.id} className="rounded-2xl border border-line p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-black rounded-md bg-sky-soft text-sky px-1.5 py-0.5">strana {s.page}</span>
                  <span className="font-bold truncate">{s.heading ?? "Časť"}</span>
                  <button
                    type="button"
                    aria-label={`Zmazať časť ${s.heading ?? s.page}`}
                    onClick={() => removeSource(s)}
                    className="ml-auto size-8 inline-flex items-center justify-center rounded-lg text-mist hover:text-tomato hover:bg-tomato-soft"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <Textarea rows={4} defaultValue={s.text} aria-label={`Text časti ${s.heading ?? s.page}`} onBlur={(e) => saveSource(s, e.target.value)} />
              </div>
            ))}
            {sources.length === 0 && <p className="rounded-2xl bg-paper px-4 py-6 text-center text-slate">Zatiaľ žiadny materiál.</p>}
          </div>

          {sources.length > 1 && (
            <div className="rounded-2xl bg-paper p-3 space-y-2">
              <p className="text-sm font-black">Z ktorých častí generovať</p>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                <label className="inline-flex items-center gap-1.5 text-sm font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fromSources.length === 0}
                    onChange={() => setFromSources(fromSources.length === 0 ? sources.slice(1).map((s) => s.id) : [])}
                    className="size-4 accent-[#1b2559]"
                  />
                  Zo všetkých
                </label>
                {sources.map((s) => (
                  <label key={s.id} className="inline-flex items-center gap-1.5 text-sm font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fromSources.length === 0 || fromSources.includes(s.id)}
                      onChange={() => {
                        const cur = fromSources.length === 0 ? sources.map((x) => x.id) : fromSources;
                        const next = cur.includes(s.id) ? cur.filter((x) => x !== s.id) : [...cur, s.id];
                        setFromSources(next.length === sources.length ? [] : next);
                      }}
                      className="size-4 accent-[#1b2559]"
                    />
                    <span className="truncate max-w-40">
                      {s.page}. {s.heading ?? "časť"}
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate font-semibold">Keď sa skúša len časť kapitoly, vyrob cvičenia len z nej.</p>
            </div>
          )}

          {sources.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <Button variant="primary" onClick={generate} loading={busy === "generate"} disabled={!ai || !!busy}>
                <Sparkles className="size-4" /> Generovať cvičenia
              </Button>
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                aria-label="Počet cvičení"
                className="h-9 rounded-xl border-2 border-line bg-card px-2 text-sm font-bold"
              >
                {[5, 10, 15, 20, 25, 30, 40, 50, 60].map((n) => (
                  <option key={n} value={n}>
                    {n} cvičení
                  </option>
                ))}
              </select>
              <span className="text-xs text-slate font-semibold">Cvičenia sa pridajú k tým, ktoré už existujú.</span>
            </div>
          )}
          {busy === "generate" && <p className="text-sm text-slate font-semibold">AI pripravuje cvičenia, trvá to asi minútu…</p>}
        </Card>
      ) : lesson ? (
        <ExercisesTab
          lesson={lesson}
          slug={slug}
          sources={sources}
          exercises={exercises}
          ai={ai}
          reload={() => reload(lesson.id)}
          onWantMore={() => setTab("material")}
        />
      ) : (
        <Card className="p-4 sm:p-5">
          <p className="rounded-2xl bg-paper px-4 py-6 text-center text-slate">Najprv ulož lekciu a nahraj materiál.</p>
        </Card>
      )}
    </div>
  );
}
