"use client";

import { ArrowLeft, Camera, Loader2, Plus, Settings, Trash2, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, Card, ErrorNote, Input, Spinner, buttonClass, cx, useBusyCursor } from "@/components/ui";
import { subjectDef, type SubjectSlug } from "@/data/subjects";
import { aiInfo, readVerbs, toJpegBase64 } from "@/lib/ai";
import { loadVerbs } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { canForms, canTranslate, type Verb } from "@/lib/verbs";

type Queue = { key: string; name: string; state: "waiting" | "reading" | "done" | "error"; note?: string };

const COLS = [
  { key: "base", label: "Základný tvar", ph: "go" },
  { key: "past", label: "Minulý čas", ph: "went" },
  { key: "participle", label: "Príčastie", ph: "gone" },
  { key: "sk", label: "Po slovensky", ph: "ísť" },
] as const;

/**
 * Zoznam nepravidelných slovies pre celú rodinu.
 * Číslo pri slovese je jeho poradie v zozname — práve podľa neho si dieťa
 * vyberá rozsah, takže po zmazaní sa prečíslujú samy.
 */
export default function VerbsAdmin({ slug }: { slug: SubjectSlug }) {
  const def = subjectDef(slug);
  const fileRef = useRef<HTMLInputElement>(null);
  const [verbs, setVerbs] = useState<Verb[] | null>(null);
  const [queue, setQueue] = useState<Queue[]>([]);
  const [ai, setAi] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const reload = () => loadVerbs().then(setVerbs);
  useEffect(() => {
    aiInfo().then((i) => setAi(i.ai));
    reload().catch(() => setVerbs([]));
  }, []);

  async function addPhotos(files: File[]) {
    if (!files.length) return;
    setError(null);
    setInfo(null);
    const items: Queue[] = files.map((f, i) => ({ key: `${Date.now()}-${i}`, name: f.name, state: "waiting" }));
    setQueue((q) => [...q, ...items]);
    let next = Math.max(0, ...(verbs ?? []).map((v) => v.num)) + 1;

    for (const [i, file] of files.entries()) {
      const item = items[i];
      setQueue((q) => q.map((x) => (x.key === item.key ? { ...x, state: "reading" } : x)));
      try {
        let img = await toJpegBase64(file);
        let r = await readVerbs(img);
        if (r.rotation) {
          setQueue((q) => q.map((x) => (x.key === item.key ? { ...x, note: "otáčam…" } : x)));
          img = await toJpegBase64(file, 2000, r.rotation);
          r = await readVerbs(img);
        }
        if (!r.verbs.length) throw new Error("Na strane sa nenašli žiadne slovesá.");
        const rows = r.verbs.map((v, j) => ({ num: next + j, base: v.base, past: v.past, participle: v.participle, sk: v.sk }));
        next += rows.length;
        const { error } = await supabase().from("tr_verbs").insert(rows);
        if (error) throw new Error(error.message);
        setQueue((q) => q.map((x) => (x.key === item.key ? { ...x, state: "done", note: `${rows.length} slovies` } : x)));
        await reload();
      } catch (e) {
        setQueue((q) => q.map((x) => (x.key === item.key ? { ...x, state: "error", note: e instanceof Error ? e.message : "Chyba" } : x)));
      }
    }
  }

  async function patch(v: Verb, field: string, value: string) {
    if ((v as unknown as Record<string, string>)[field] === value) return;
    setVerbs((cur) => (cur ?? []).map((x) => (x.id === v.id ? { ...x, [field]: value } : x)));
    const { error } = await supabase().from("tr_verbs").update({ [field]: value }).eq("id", v.id);
    if (error) setError(error.message);
  }

  async function remove(v: Verb, index: number) {
    if (!window.confirm(`Zmazať sloveso ${index + 1}. ${v.base}?`)) return;
    const { error } = await supabase().from("tr_verbs").delete().eq("id", v.id);
    if (error) setError(error.message);
    await reload();
  }

  async function addRow() {
    const num = Math.max(0, ...(verbs ?? []).map((v) => v.num)) + 1;
    const { error } = await supabase().from("tr_verbs").insert({ num, base: "nové sloveso", past: "", participle: "", sk: "" });
    if (error) setError(error.message);
    await reload();
    setInfo("Nový riadok je na konci zoznamu, prepíš ho.");
  }

  const working = queue.some((q) => q.state === "reading" || q.state === "waiting");
  useBusyCursor(working);

  if (!verbs) return <Spinner />;

  const incomplete = verbs.filter((v) => !canTranslate(v) || !canForms(v)).length;

  return (
    <div className="space-y-5">
      <Link href="/rodic" className="inline-flex items-center gap-1 text-sm font-bold text-slate">
        <ArrowLeft className="size-4" /> Prehľad
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-4xl">{def?.icon}</span>
        <h1 className="text-2xl font-black mr-auto">{def?.name}</h1>
        <Link href={`/rodic/${slug}/nastavenia`} className={buttonClass("outline", "sm")}>
          <Settings className="size-4" /> Nastavenia
        </Link>
      </div>

      <Card className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 max-w-prose">
            <h2 className="text-lg font-black">Strany so slovesami</h2>
            <p className="text-sm text-slate mt-0.5">
              Nafoť stranu s tabuľkou slovies. Appka ich prepíše a zaradí na koniec zoznamu v poradí, v akom sú na strane.
            </p>
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
          <Button variant="sun" onClick={() => fileRef.current?.click()} loading={working} disabled={!ai || working}>
            {!working && <Camera className="size-4" />} {working ? "Čítam strany…" : verbs.length ? "Pridať strany" : "Vybrať fotky"}
          </Button>
        </div>
        {!ai && (
          <p className="text-sm text-slate rounded-xl bg-paper px-3 py-2">
            Čítanie fotiek sa zapne po nastavení kľúča <code className="font-mono text-xs">OPENAI_API_KEY</code> vo Verceli. Slovesá môžeš zatiaľ pridávať ručne.
          </p>
        )}
        {queue.length > 0 && (
          <ul className="grid gap-2 sm:grid-cols-2" aria-live="polite">
            {queue.map((q) => (
              <li key={q.key} className="flex items-center gap-2 rounded-2xl border border-line p-2 text-sm">
                {q.state === "reading" ? <Loader2 className="size-4 animate-spin text-sky" /> : q.state === "error" ? <X className="size-4 text-tomato" /> : <Camera className="size-4 text-mist" />}
                <span className="truncate flex-1">{q.name}</span>
                <span className={cx("font-bold", q.state === "error" ? "text-tomato" : "text-slate")}>
                  {q.note ?? (q.state === "reading" ? "čítam…" : q.state === "waiting" ? "čaká" : "hotovo")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {error && <ErrorNote>{error}</ErrorNote>}
      {info && <p className="rounded-xl bg-leaf-soft text-leaf px-3 py-2 text-sm font-semibold">{info}</p>}

      <Card className="p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-black mr-auto">Zoznam ({verbs.length})</h2>
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="size-4" /> Pridať sloveso
          </Button>
        </div>
        {incomplete > 0 && (
          <p className="inline-flex items-center gap-1.5 text-sm font-bold text-sun-deep">
            <TriangleAlert className="size-4" /> {incomplete} slovies má prázdne políčko — na tie sa dieťa nebude pýtať.
          </p>
        )}

        {verbs.length === 0 ? (
          <p className="rounded-2xl bg-paper px-4 py-6 text-center text-slate">Zoznam je prázdny. Nafoť stranu so slovesami alebo pridaj prvé ručne.</p>
        ) : (
          <ul className="space-y-2" aria-label="Zoznam slovies">
            {verbs.map((v, i) => (
              <li key={v.id} className="rounded-2xl border border-line p-2.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-black rounded-md bg-sky-soft text-sky px-1.5 py-0.5 tabular-nums">{i + 1}.</span>
                  <span className="font-bold truncate">{v.base}</span>
                  <button
                    type="button"
                    aria-label={`Zmazať sloveso ${i + 1}`}
                    onClick={() => remove(v, i)}
                    className="ml-auto size-8 inline-flex items-center justify-center rounded-lg text-mist hover:text-tomato hover:bg-tomato-soft"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-4">
                  {COLS.map((c) => (
                    <label key={c.key} className="block">
                      <span className="block text-xs font-bold text-slate mb-0.5">{c.label}</span>
                      <Input
                        defaultValue={v[c.key]}
                        placeholder={c.ph}
                        maxLength={120}
                        aria-label={`${c.label} slovesa ${i + 1}`}
                        onBlur={(e) => patch(v, c.key, e.target.value.trim())}
                      />
                    </label>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
