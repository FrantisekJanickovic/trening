"use client";

import { BadgeCheck, Check, CircleHelp, Eye, EyeOff, ListChecks, Loader2, Pencil, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ExerciseForm, emptyPayload } from "@/components/exercise/editors";
import { Button, Card, ErrorNote, Input, cx } from "@/components/ui";
import type { SubjectSlug } from "@/data/subjects";
import { loadSets } from "@/lib/data";
import { aspectDef, preview, solutionLines, typeLabel, type ExerciseType, type Payload } from "@/lib/exercises";
import { runFactcheck } from "@/lib/factcheck";
import { supabase } from "@/lib/supabase";
import type { Exercise, ExerciseSet, Lesson, Source } from "@/lib/types";

type Props = {
  lesson: Lesson;
  slug: SubjectSlug;
  sources: Source[];
  exercises: Exercise[];
  ai: boolean;
  reload: () => Promise<void>;
  onWantMore: () => void;
};

export default function ExercisesTab({ lesson, slug, sources, exercises, ai, reload, onWantMore }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState<ExerciseType | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [setName, setSetName] = useState("");
  const [sets, setSets] = useState<ExerciseSet[]>([]);
  const [review, setReview] = useState<number | null>(null);
  const [busy, setBusy] = useState<"check" | "set" | null>(null);
  // prepínač sa prekreslí hneď, nečaká sa na načítanie zoznamu z databázy
  const [pendingChecked, setPendingChecked] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const reloadSets = useCallback(() => loadSets([lesson.id]).then(setSets), [lesson.id]);
  useEffect(() => {
    reloadSets().catch(() => setSets([]));
  }, [reloadSets]);

  const isChecked = (e: Exercise) => pendingChecked[e.id] ?? e.checked;
  const unchecked = exercises.filter((e) => !isChecked(e));

  async function check(only: Exercise[]) {
    setBusy("check");
    setError(null);
    setInfo(null);
    try {
      const r = await runFactcheck({ slug, lesson, sources, exercises: only });
      await reload();
      setInfo(
        r.problems
          ? `Hotovo: ${r.checked} v poriadku, ${r.problems} s výhradou — pozri poznámky nižšie.`
          : r.checked === 1
            ? "Hotovo, cvičenie je v poriadku."
            : `Hotovo, všetkých ${r.checked} cvičení je v poriadku.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kontrola zlyhala.");
    } finally {
      setBusy(null);
    }
  }

  async function setChecked(e: Exercise, v: boolean) {
    setPendingChecked((o) => ({ ...o, [e.id]: v }));
    await supabase().from("tr_exercises").update({ checked: v, check_note: v ? null : e.check_note }).eq("id", e.id);
    await reload();
    setPendingChecked((o) => {
      const next = { ...o };
      delete next[e.id];
      return next;
    });
  }

  async function saveExercise(id: string | null, type: ExerciseType, payload: Payload, concept: string) {
    const sb = supabase();
    // po ručnej úprave už kontrola neplatí, cvičenie sa musí skontrolovať znova
    const { error } = id
      ? await sb.from("tr_exercises").update({ payload, concept, checked: false, check_note: null, updated_at: new Date().toISOString() }).eq("id", id)
      : await sb.from("tr_exercises").insert({ lesson_id: lesson.id, type, payload, concept, level: 1, position: Date.now() });
    if (error) throw new Error(error.message);
    setEditing(null);
    setAdding(null);
    await reload();
  }

  async function removeExercise(e: Exercise) {
    if (!window.confirm("Zmazať toto cvičenie?")) return;
    await supabase().from("tr_exercises").delete().eq("id", e.id);
    await reload();
  }

  async function toggleEnabled(e: Exercise) {
    await supabase().from("tr_exercises").update({ enabled: !e.enabled }).eq("id", e.id);
    await reload();
  }

  async function createSet() {
    const name = setName.trim();
    if (!name || !picked.length) return;
    setBusy("set");
    setError(null);
    try {
      const { error } = await supabase()
        .from("tr_sets")
        .insert({ lesson_id: lesson.id, name, exercise_ids: picked, position: Date.now() });
      if (error) throw new Error(error.message);
      setPicked([]);
      setSetName("");
      await reloadSets();
      setInfo(`Sada „${name}“ je pripravená, dieťa ju uvidí pod lekciou.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sadu sa nepodarilo vytvoriť.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleSet(s: ExerciseSet) {
    setSets((cur) => cur.map((x) => (x.id === s.id ? { ...x, active: !x.active } : x)));
    await supabase().from("tr_sets").update({ active: !s.active }).eq("id", s.id);
    await reloadSets();
  }

  async function removeSet(s: ExerciseSet) {
    if (!window.confirm(`Zmazať sadu „${s.name}“? Cvičenia ostanú.`)) return;
    await supabase().from("tr_sets").delete().eq("id", s.id);
    await reloadSets();
  }

  /** Review: rodič prejde cvičenia jedno po druhom a nechá len tie, ktoré chce. */
  async function reviewAnswer(keep: boolean) {
    const i = review ?? 0;
    const e = exercises[i];
    if (e) {
      const patch = keep ? { checked: true, check_note: null } : { enabled: false };
      await supabase().from("tr_exercises").update(patch).eq("id", e.id);
    }
    if (i + 1 >= exercises.length) {
      setReview(null);
      await reload();
      setInfo("Review hotové.");
      return;
    }
    setReview(i + 1);
  }

  if (review !== null && exercises[review]) {
    const e = exercises[review];
    return (
      <Card className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-black mr-auto">Review cvičení</h2>
          <span className="text-sm font-black text-slate tabular-nums">
            {review + 1} / {exercises.length}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setReview(null);
              void reload();
            }}
          >
            <X className="size-4" /> Skončiť
          </Button>
        </div>
        <div className="h-2 rounded-full bg-line overflow-hidden">
          <div className="h-full bg-sun rounded-full transition-[width]" style={{ width: `${(review / exercises.length) * 100}%` }} />
        </div>

        <div className="rounded-2xl border-2 border-line p-4">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="rounded-md bg-sky-soft text-sky px-1.5 py-0.5 text-xs font-black">{typeLabel(e.type)}</span>
            {e.concept && <span className="rounded-md bg-paper text-slate px-1.5 py-0.5 text-xs font-bold">{e.concept}</span>}
            {aspectDef(e.aspect) && <span className="rounded-md bg-sun-soft text-sun-deep px-1.5 py-0.5 text-xs font-bold">{aspectDef(e.aspect)!.label}</span>}
            {!e.enabled && <span className="rounded-md bg-tomato-soft text-tomato px-1.5 py-0.5 text-xs font-black">teraz vypnuté</span>}
          </div>
          <p className="text-lg font-black break-words">{preview(e.type, e.payload)}</p>
          <p className="text-sm font-black text-slate mt-3">Správna odpoveď</p>
          <ul className="mt-1 space-y-1">
            {solutionLines(e.type, e.payload).map((l, i) => (
              <li key={i} className="font-bold text-leaf break-words">
                {l}
              </li>
            ))}
          </ul>
          {e.check_note && <p className="mt-3 text-sm font-bold text-tomato">Kontrola AI: {e.check_note}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="leaf" size="lg" onClick={() => reviewAnswer(true)}>
            <Check className="size-5" /> Áno, nechať
          </Button>
          <Button variant="danger" size="lg" onClick={() => reviewAnswer(false)}>
            <X className="size-5" /> Nie, vypnúť
          </Button>
        </div>
        <p className="text-xs text-slate font-semibold text-center">Vypnuté cvičenie dieťa neuvidí. Zapnúť sa dá kedykoľvek späť v zozname.</p>
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-black mr-auto">Cvičenia ({exercises.length})</h2>
        <select
          value={adding ?? ""}
          onChange={(ev) => setAdding((ev.target.value || null) as ExerciseType | null)}
          aria-label="Pridať cvičenie typu"
          className="h-9 rounded-xl border-2 border-line bg-card px-2 text-sm font-bold"
        >
          <option value="">Pridať cvičenie…</option>
          {(["mcq", "truefalse", "pairs", "cloze", "order"] as ExerciseType[]).map((t) => (
            <option key={t} value={t}>
              {typeLabel(t)}
            </option>
          ))}
        </select>
      </div>

      {exercises.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-paper p-3">
          <Button variant="outline" size="sm" onClick={() => setReview(0)} disabled={!!busy}>
            <ListChecks className="size-4" /> Review cvičení
          </Button>
          <Button variant="outline" size="sm" onClick={() => check(unchecked)} disabled={!ai || !!busy || !unchecked.length}>
            {busy === "check" ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} Skontrolovať neoznačené ({unchecked.length})
          </Button>
          <span className="text-xs font-bold text-slate">
            Skontrolované: {exercises.length - unchecked.length} z {exercises.length}
          </span>
        </div>
      )}
      {busy === "check" && <p className="text-sm text-slate font-semibold">AI porovnáva cvičenia s materiálom, chvíľu to potrvá…</p>}
      {error && <ErrorNote>{error}</ErrorNote>}
      {info && <p className="rounded-xl bg-leaf-soft text-leaf px-3 py-2 text-sm font-semibold">{info}</p>}

      {adding && (
        <ExerciseForm type={adding} payload={emptyPayload(adding)} concept="" onCancel={() => setAdding(null)} onSave={(p, c) => saveExercise(null, adding, p, c)} />
      )}

      {exercises.length === 0 ? (
        <p className="rounded-2xl bg-paper px-4 py-6 text-center text-slate">Zatiaľ žiadne cvičenia. Nahraj materiál a stlač „Generovať cvičenia“.</p>
      ) : (
        <ul className="divide-y divide-line" aria-label="Zoznam cvičení">
          {exercises.map((e) =>
            editing === e.id ? (
              <li key={e.id} className="py-3">
                <ExerciseForm type={e.type} payload={e.payload} concept={e.concept} onCancel={() => setEditing(null)} onSave={(p, c) => saveExercise(e.id, e.type, p, c)} />
              </li>
            ) : (
              <li key={e.id} className={cx("py-3 flex items-start gap-2", !e.enabled && "opacity-60")}>
                <input
                  type="checkbox"
                  className="mt-1.5 size-4 shrink-0 accent-[#1b2559]"
                  checked={picked.includes(e.id)}
                  aria-label={`Vybrať do sady: ${preview(e.type, e.payload).slice(0, 40)}`}
                  onChange={() => setPicked((cur) => (cur.includes(e.id) ? cur.filter((x) => x !== e.id) : [...cur, e.id]))}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md bg-sky-soft text-sky px-1.5 py-0.5 text-xs font-black">{typeLabel(e.type)}</span>
                    {e.concept && <span className="rounded-md bg-paper text-slate px-1.5 py-0.5 text-xs font-bold">{e.concept}</span>}
                    {aspectDef(e.aspect) && <span className="rounded-md bg-mist/20 text-slate px-1.5 py-0.5 text-xs font-bold">{aspectDef(e.aspect)!.label}</span>}
                    {e.level > 1 && (
                      <span className="rounded-md bg-sun-soft text-sun-deep px-1.5 py-0.5 text-xs font-black">{e.level === 3 ? "záludné" : "náročnejšie"}</span>
                    )}
                  </div>
                  <p className="font-bold mt-1 break-words">{preview(e.type, e.payload)}</p>
                  <ul className="text-sm text-slate">
                    {solutionLines(e.type, e.payload).map((l, i) => (
                      <li key={i} className="break-words">
                        {l}
                      </li>
                    ))}
                  </ul>
                  {e.check_note && <p className="text-sm font-bold text-tomato mt-1 break-words">Kontrola AI: {e.check_note}</p>}
                  <label className="inline-flex items-center gap-1.5 mt-1.5 text-xs font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      aria-label="Skontrolované"
                      checked={isChecked(e)}
                      onChange={() => setChecked(e, !isChecked(e))}
                      className="size-3.5 accent-[#1f9d63]"
                    />
                    <BadgeCheck className={cx("size-3.5", isChecked(e) ? "text-leaf" : "text-mist")} />
                    {isChecked(e) ? "skontrolované" : "neskontrolované"}
                  </label>
                </div>
                <button
                  type="button"
                  aria-label={`${e.enabled ? "Vypnúť" : "Zapnúť"} cvičenie`}
                  onClick={() => toggleEnabled(e)}
                  className="shrink-0 size-8 inline-flex items-center justify-center rounded-lg text-mist hover:text-ink hover:bg-ink/5"
                >
                  {e.enabled ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                </button>
                <button
                  type="button"
                  aria-label={`Upraviť cvičenie: ${preview(e.type, e.payload).slice(0, 40)}`}
                  onClick={() => setEditing(e.id)}
                  className="shrink-0 size-8 inline-flex items-center justify-center rounded-lg text-slate hover:bg-ink/5"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Zmazať cvičenie: ${preview(e.type, e.payload).slice(0, 40)}`}
                  onClick={() => removeExercise(e)}
                  className="shrink-0 size-8 inline-flex items-center justify-center rounded-lg text-mist hover:text-tomato hover:bg-tomato-soft"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ),
          )}
        </ul>
      )}

      {picked.length > 0 && (
        <div className="rounded-2xl border-2 border-sun-deep bg-sun-soft p-3 space-y-2">
          <p className="font-black">Nová sada z {picked.length} vybraných cvičení</p>
          <p className="text-sm text-slate font-semibold">Dieťa ju uvidí pod lekciou ako samostatný tréning — hodí sa, keď sa skúša len časť učiva.</p>
          <div className="flex flex-wrap gap-2">
            <Input value={setName} onChange={(ev) => setSetName(ev.target.value)} maxLength={80} placeholder="napr. Len panovníci" aria-label="Názov sady" className="flex-1 min-w-48" />
            <Button onClick={createSet} loading={busy === "set"} disabled={!setName.trim()}>
              <Plus className="size-4" /> Vytvoriť sadu
            </Button>
            <Button variant="ghost" onClick={() => setPicked([])}>
              Zrušiť výber
            </Button>
          </div>
        </div>
      )}

      {sets.length > 0 && (
        <div className="border-t border-line pt-3">
          <h3 className="font-black mb-2">Sady ({sets.length})</h3>
          <ul className="space-y-2">
            {sets.map((s) => (
              <li key={s.id} className={cx("flex flex-wrap items-center gap-2 rounded-2xl border p-2.5", s.active ? "border-leaf bg-leaf-soft/40" : "border-line")}>
                <span className="font-black">{s.name}</span>
                <span className="text-sm text-slate font-semibold">{s.exercise_ids.length} cvičení</span>
                <label className="ml-auto inline-flex items-center gap-1.5 text-sm font-bold cursor-pointer">
                  <input type="checkbox" checked={s.active} onChange={() => toggleSet(s)} className="size-4 accent-[#1f9d63]" />
                  Aktívna
                </label>
                <button
                  type="button"
                  aria-label={`Zmazať sadu ${s.name}`}
                  onClick={() => removeSet(s)}
                  className="size-8 inline-flex items-center justify-center rounded-lg text-mist hover:text-tomato hover:bg-tomato-soft"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {exercises.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onWantMore}>
            <Plus className="size-4" /> Vyrobiť ďalšie z materiálu
          </Button>
          {!ai && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-slate">
              <CircleHelp className="size-3.5" /> Kontrola AI je vypnutá, chýba kľúč vo Verceli.
            </span>
          )}
        </div>
      )}
    </Card>
  );
}
