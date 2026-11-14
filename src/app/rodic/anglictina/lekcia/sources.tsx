"use client";

import { AlertCircle, Camera, Check, Loader2, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { TypeTags } from "@/components/en/type-tags";
import PromptBox from "@/components/prompt-box";
import { Button, Card, cx, ErrorNote } from "@/components/ui";
import { segmentPhoto, type PageResult } from "@/lib/en/ai";
import { sameSet, sourceStatus, sourceTypeLabel, type SourceStatus } from "@/lib/en/sources";
import type { LessonSource, SourceType } from "@/lib/en/types";

export type UploadItem = { key: string; file: File; url: string; page: number; status: "wait" | "read" | "done" | "error"; found?: number; error?: string };

/** Reads selected textbook photos two at a time; each finished page is handed to onPage. */
export function usePageImport(opts: {
  ensureLesson: () => Promise<string>;
  grade: number | null;
  lastPage: () => number;
  onPage: (page: number, result: PageResult, lessonId: string) => Promise<void>;
}) {
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const items = useRef<UploadItem[]>([]);
  const running = useRef(false);
  const latest = useRef(opts);
  useEffect(() => {
    latest.current = opts;
  });

  useEffect(() => () => items.current.forEach((i) => URL.revokeObjectURL(i.url)), []);

  const update = (key: string, patch: Partial<UploadItem>) => {
    items.current = items.current.map((i) => (i.key === key ? { ...i, ...patch } : i));
    setQueue(items.current);
  };

  async function run() {
    if (running.current) return;
    running.current = true;
    try {
      let lessonId: string;
      try {
        lessonId = await latest.current.ensureLesson();
      } catch (e) {
        for (const i of items.current.filter((x) => x.status === "wait"))
          update(i.key, { status: "error", error: e instanceof Error ? e.message : "Lekciu sa nepodarilo uložiť." });
        return;
      }
      const worker = async () => {
        for (;;) {
          const it = items.current.find((x) => x.status === "wait");
          if (!it) return;
          update(it.key, { status: "read", error: undefined });
          try {
            const r = await segmentPhoto(it.file, latest.current.grade);
            await latest.current.onPage(it.page, r, lessonId);
            update(it.key, { status: "done", found: r.exercises.length });
          } catch (e) {
            update(it.key, { status: "error", error: e instanceof Error ? e.message : "Fotku sa nepodarilo prečítať." });
          }
        }
      };
      await Promise.all([worker(), worker()]);
    } finally {
      running.current = false;
      if (items.current.some((x) => x.status === "wait")) run();
    }
  }

  function add(files: File[]) {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (!images.length) return;
    let page = Math.max(latest.current.lastPage(), ...items.current.map((i) => i.page), 0);
    const added = images.map((file) => ({ key: crypto.randomUUID(), file, url: URL.createObjectURL(file), page: ++page, status: "wait" as const }));
    items.current = [...items.current, ...added];
    setQueue(items.current);
    run();
  }

  function retry(key: string) {
    update(key, { status: "wait", error: undefined });
    run();
  }

  const active = queue.some((i) => i.status === "wait" || i.status === "read");
  return { queue, add, retry, active };
}

const toneClass: Record<SourceStatus["tone"], string> = {
  todo: "bg-sun-soft text-sun-deep",
  changed: "bg-sun-soft text-sun-deep",
  done: "bg-leaf-soft text-leaf",
  skip: "bg-paper text-slate",
  empty: "bg-tomato-soft text-tomato",
};

function rowsFor(text: string) {
  const lines = text.split("\n").reduce((n, l) => n + Math.max(1, Math.ceil(l.length / 58)), 0);
  return Math.min(14, Math.max(2, lines));
}

export function UploadPanel({
  hasSources,
  ai,
  disabled,
  importer,
}: {
  hasSources: boolean;
  ai: boolean;
  disabled: boolean;
  importer: ReturnType<typeof usePageImport>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <Card className="p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-prose">
          <h2 className="text-lg font-black">Strany z učebnice</h2>
          <p className="text-sm text-slate mt-0.5">
            Vyber alebo odfoť jednu či viac strán. Appka každú stranu rozdelí na cvičenia a pri každom navrhne typ. Typy uprav a potom vytvor cvičenia.
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            importer.add(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <Button variant="sun" onClick={() => fileRef.current?.click()} disabled={!ai || disabled}>
          <Camera className="size-4" /> {hasSources ? "Pridať strany" : "Vybrať fotky"}
        </Button>
      </div>
      {!ai && (
        <p className="text-sm text-slate rounded-xl bg-paper px-3 py-2">
          Čítanie fotiek sa zapne po nastavení kľúča <code className="font-mono text-xs">OPENAI_API_KEY</code> alebo{" "}
          <code className="font-mono text-xs">ANTHROPIC_API_KEY</code> vo Verceli. Slovíčka, gramatiku aj texty môžeš zatiaľ zadať ručne v ďalších záložkách.
        </p>
      )}
      {importer.queue.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2" aria-live="polite">
          {importer.queue.map((i) => (
            <li key={i.key} className="flex items-center gap-3 rounded-2xl border border-line p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i.url} alt="" className="size-14 rounded-xl object-cover bg-paper shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-bold">Strana {i.page}</div>
                <div className={cx("text-sm", i.status === "error" ? "text-tomato" : "text-slate")}>
                  {i.status === "wait" && "Čaká…"}
                  {i.status === "read" && (
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 className="size-3.5 animate-spin" /> Čítam stranu…
                    </span>
                  )}
                  {i.status === "done" && (
                    <span className="inline-flex items-center gap-1.5 text-leaf font-bold">
                      <Check className="size-3.5" /> {i.found ? `${i.found} ${pl(i.found, "cvičenie", "cvičenia", "cvičení")}` : "Žiadne cvičenia"}
                    </span>
                  )}
                  {i.status === "error" && <span className="line-clamp-2">{i.error}</span>}
                </div>
              </div>
              {i.status === "error" && (
                <Button size="sm" variant="outline" onClick={() => importer.retry(i.key)}>
                  <RotateCcw className="size-4" /> Znova
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const SOURCE_PRESETS = [
  { key: "lenslova", label: "Len slovíčka", fill: "Z tohto cvičenia rob len slovíčka, vety ani gramatiku nevyrábaj." },
  { key: "lahsie", label: "Jednoduchšie", fill: "Píš kratšie vety a jednoduchšie slová, je to pre mladšie dieťa." },
  { key: "cleny", label: "Aj s členmi", fill: "Pri podstatných menách nechaj člen (a, an, the) tak, ako je v učebnici." },
];

export function SourceCard({
  src,
  made,
  error,
  disabled,
  onTypes,
  note,
  onNote,
  ai,
}: {
  src: LessonSource;
  made: string;
  error?: string;
  disabled: boolean;
  onTypes: (t: SourceType[]) => void;
  /** vlastný pokyn rodiča, ktorý ide do AI spolu s týmto cvičením */
  note?: string;
  onNote?: (v: string) => void;
  ai?: boolean;
}) {
  const st = sourceStatus(src);
  const label = src.label || "Cvičenie";
  const changedFromAi = src.suggested.length > 0 && !sameSet(src.types, src.suggested);
  return (
    <Card
      className={cx(
        // farebný pruh zľava a silnejší rámik, nech je vidieť, kde cvičenie začína a končí
        "p-4 sm:p-5 space-y-3 border-2 border-l-8",
        st.tone === "done" ? "border-leaf/40 border-l-leaf" : st.tone === "skip" ? "bg-card/70 border-line border-l-mist" : "border-sky/40 border-l-sky",
      )}
    >
      <div className="flex flex-wrap items-start gap-3">
        <span className="shrink-0 min-w-9 h-9 px-2.5 rounded-xl bg-ink text-white font-black text-sm inline-flex items-center justify-center">{label}</span>
        <div className="flex-1 min-w-48">
          <p className={cx("font-bold leading-snug", !src.instruction && "text-slate")}>{src.instruction || "Bez zadania"}</p>
          {src.note && <p className="text-sm text-slate mt-0.5">{src.note}</p>}
        </div>
        <span className={cx("ml-auto shrink-0 rounded-full px-3 py-1 text-xs font-black", toneClass[st.tone])}>
          {st.label}
          {st.tone === "done" && made ? ` · ${made}` : ""}
        </span>
      </div>
      <textarea
        readOnly
        value={src.content}
        rows={rowsFor(src.content)}
        aria-label={`Prepis cvičenia ${label}`}
        className="w-full rounded-xl border-2 border-line bg-paper px-3 py-2.5 text-[15px] leading-relaxed text-ink resize-y outline-none focus:border-mist cursor-default"
      />
      {onNote && src.types.length > 0 && !src.types.includes("skip") && (
        <PromptBox
          presets={SOURCE_PRESETS}
          mode="fill"
          value={note ?? ""}
          onChange={onNote}
          disabled={disabled || !ai}
          label={`Pokyn pre AI k cvičeniu ${label}`}
          hint="Nepovinné. Použije sa pri vytváraní cvičení z tohto zadania."
          placeholder="napr. ber len slová z obrázkov"
        />
      )}
      <div>
        <span className="block text-sm font-bold text-ink-soft mb-1.5" id={`types-${src.id}`}>
          Typ cvičenia
        </span>
        <fieldset disabled={disabled} className="disabled:opacity-60">
          <TypeTags label={`Typ cvičenia ${label}`} value={src.types} onChange={onTypes} />
        </fieldset>
        {changedFromAi && (
          <p className="text-xs text-slate mt-1.5">
            Návrh AI: {src.suggested.map(sourceTypeLabel).join(", ")}.{" "}
            <button type="button" className="font-bold text-sky hover:underline disabled:opacity-50" disabled={disabled} onClick={() => onTypes(src.suggested)}>
              Vrátiť návrh
            </button>
          </p>
        )}
      </div>
      {error && (
        <ErrorNote>
          <span className="inline-flex items-start gap-1.5">
            <AlertCircle className="size-4 mt-0.5 shrink-0" /> Cvičenia sa nepodarilo vytvoriť: {error}
          </span>
        </ErrorNote>
      )}
    </Card>
  );
}

/** Slovak plural: 1 / 2–4 / 5+ */
export function pl(n: number, one: string, few: string, many: string) {
  return n === 1 ? one : n >= 2 && n <= 4 ? few : many;
}
