"use client";

import { ArrowLeft, Check, ClipboardPaste, Plus, Sparkles, Trash2, Wand2, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, Card, cx, ErrorNote, Field, Input, Segmented, Spinner, Textarea } from "@/components/ui";
import { aiStatus, buildFromSource, enrichVocab, generateGrammar, translateSentences, type BuildResult, type PageResult } from "@/lib/en/ai";
import { listChildren, loadContent } from "@/lib/en/data";
import { GRADES, gradeLabel } from "@/lib/en/settings";
import { effective, isPending } from "@/lib/en/sources";
import { supabase } from "@/lib/supabase";
import { normalize } from "@/lib/en/text";
import type { Lesson, LessonSource, Sentence, SourceType, TextUse } from "@/lib/en/types";
import AiPanel from "./ai-panel";
import { ProblemsPanel } from "./problems";
import { pl, SourceCard, UploadPanel, usePageImport } from "./sources";

type VRow = { id: string; code?: string | null; en: string; sk: string; example_en: string; example_sk: string; emoji: string; source_id: string | null };
type GRow = { id: string; code?: string | null; prompt: string; answer: string; options: string; translation_sk: string; explanation_sk: string; source_id: string | null };
type SRow = { id: string; en: string; sk: string };
type TRow = { id: string; code?: string | null; title: string; sentences: SRow[]; uses: TextUse[]; source_id: string | null };
type Meta = { title: string; textbook: string; unit: string; grade: string; notes: string };
type Deleted = { vocab: string[]; grammar: string[]; texts: string[] };
type Snapshot = { meta: Meta; vocab: VRow[]; grammar: GRow[]; texts: TRow[]; deleted: Deleted };
type Tab = "sources" | "vocab" | "grammar" | "texts" | "problems";

const LAST_GRADE = "anglictina.lastGrade";
const readLastGrade = () => {
  try {
    return localStorage.getItem(LAST_GRADE) ?? "";
  } catch {
    return "";
  }
};

const uid = () => crypto.randomUUID();
const emptyV = (): VRow => ({ id: uid(), en: "", sk: "", example_en: "", example_sk: "", emoji: "", source_id: null });
const emptyG = (): GRow => ({ id: uid(), prompt: "", answer: "", options: "", translation_sk: "", explanation_sk: "", source_id: null });
const withIds = (s: Sentence[]): SRow[] => s.map((x) => ({ id: x.id ?? uid(), en: x.en ?? "", sk: x.sk ?? "" }));
const emptyMeta: Meta = { title: "", textbook: "", unit: "", grade: "", notes: "" };
const noDeleted: Deleted = { vocab: [], grammar: [], texts: [] };

const USES: { value: TextUse; label: string }[] = [
  { value: "reading", label: "Čítanie" },
  { value: "listening", label: "Počúvanie" },
  { value: "writing", label: "Písanie viet" },
];

function parseList(text: string): VRow[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = (line.includes("\t") ? line.split("\t") : line.split(/\s[-–—=]\s|;/)).map((p) => p.trim());
      return { ...emptyV(), en: parts[0] ?? "", sk: parts[1] ?? "", example_en: parts[2] ?? "", example_sk: parts[3] ?? "" };
    })
    .filter((r) => r.en);
}

function splitSentences(text: string) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z"“])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const sortSources = (s: LessonSource[]) => [...s].sort((a, b) => a.page - b.page || a.position - b.position);

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(size, queue.length) }, async () => {
      while (queue.length) await fn(queue.shift()!);
    }),
  );
}

function madeSummary(v: number, g: number, t: number, w: number) {
  return [
    v && `${v} ${pl(v, "slovíčko", "slovíčka", "slovíčok")}`,
    g && `${g} gramatika`,
    t && `${t} ${pl(t, "text", "texty", "textov")}`,
    w && `${w} ${pl(w, "veta", "vety", "viet")}`,
  ]
    .filter(Boolean)
    .join(", ");
}

export default function LessonEditor() {
  const urlId = useSearchParams().get("id");
  const router = useRouter();
  const [lessonId, setLessonIdState] = useState<string | null>(null);
  const idRef = useRef<string | null>(null);
  const loadedFor = useRef<string | null | undefined>(undefined);
  const autoTitle = useRef(false);
  const [loading, setLoading] = useState(!!urlId);
  const [meta, setMeta] = useState<Meta>(emptyMeta);
  const [vocab, setVocab] = useState<VRow[]>([]);
  const [grammar, setGrammar] = useState<GRow[]>([]);
  const [texts, setTexts] = useState<TRow[]>([]);
  const [sources, setSources] = useState<LessonSource[]>([]);
  const [deleted, setDeleted] = useState<Deleted>(noDeleted);
  const [tab, setTab] = useState<Tab>("sources");
  const [ai, setAi] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [buildErrors, setBuildErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [paste, setPaste] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [textPaste, setTextPaste] = useState("");
  const [problemCount, setProblemCount] = useState(0);

  const setLessonId = (id: string | null) => {
    idRef.current = id;
    loadedFor.current = id;
    setLessonIdState(id);
  };

  useEffect(() => {
    aiStatus().then(setAi);
  }, []);

  // Load the lesson from the URL. Our own URL update after creating a lesson is skipped.
  useEffect(() => {
    if (loadedFor.current === urlId) return;
    loadedFor.current = urlId;
    idRef.current = urlId;
    setLessonIdState(urlId);
    setDeleted(noDeleted);
    setBuildErrors({});
    setNote(null);
    setError(null);
    if (!urlId) {
      const last = readLastGrade();
      setMeta({ ...emptyMeta, grade: last });
      if (!last) listChildren().then((kids) => kids[0] && setMeta((m) => (m.grade ? m : { ...m, grade: String(kids[0].grade) })));
      setVocab([emptyV(), emptyV(), emptyV()]);
      setGrammar([]);
      setTexts([]);
      setSources([]);
      setProblemCount(0);
      setTab("sources");
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const sb = supabase();
      const [{ data }, c, src, open] = await Promise.all([
        sb.from("lessons").select("*").eq("id", urlId).maybeSingle(),
        loadContent([urlId]),
        sb.from("lesson_sources").select("*").eq("lesson_id", urlId).order("page").order("position"),
        sb.from("problem_items").select("id", { count: "exact", head: true }).eq("lesson_id", urlId).eq("mastered", false),
      ]);
      setProblemCount(open.count ?? 0);
      if (loadedFor.current !== urlId) return;
      const l = data as Lesson | null;
      if (l) setMeta({ title: l.title, textbook: l.textbook ?? "", unit: l.unit ?? "", grade: l.grade ? String(l.grade) : "", notes: l.notes ?? "" });
      setVocab(
        c.vocab.map((v) => ({
          id: v.id,
          code: v.code ?? null,
          en: v.en,
          sk: v.sk,
          example_en: v.example_en ?? "",
          example_sk: v.example_sk ?? "",
          emoji: v.emoji ?? "",
          source_id: v.source_id ?? null,
        })),
      );
      setGrammar(
        c.grammar.map((g) => ({
          id: g.id,
          code: g.code ?? null,
          prompt: g.prompt,
          answer: g.answer,
          options: (g.options ?? []).join(", "),
          translation_sk: g.translation_sk ?? "",
          explanation_sk: g.explanation_sk ?? "",
          source_id: g.source_id ?? null,
        })),
      );
      setTexts(
        c.texts.map((t) => ({
          id: t.id,
          code: t.code ?? null,
          title: t.title ?? "",
          sentences: withIds(t.sentences ?? []),
          uses: t.uses?.length ? t.uses : ["reading", "listening"],
          source_id: t.source_id ?? null,
        })),
      );
      const rows = (src.data ?? []) as LessonSource[];
      setSources(rows);
      setTab(rows.length ? "sources" : "vocab");
      setLoading(false);
    })();
  }, [urlId]);

  const dirty = () => {
    setSaved(false);
    setNote(null);
  };
  const setM = (patch: Partial<Meta>) => {
    dirty();
    setMeta((m) => ({ ...m, ...patch }));
  };
  const setT = (fn: (rows: TRow[]) => TRow[]) => {
    dirty();
    setTexts(fn);
  };
  const updV = (i: number, k: keyof VRow, v: string) => {
    dirty();
    setVocab((rows) => rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  };
  const delV = (i: number) => {
    dirty();
    setDeleted((d) => ({ ...d, vocab: [...d.vocab, vocab[i].id] }));
    setVocab((rows) => rows.filter((_, j) => j !== i));
  };
  const updG = (i: number, k: keyof GRow, v: string) => {
    dirty();
    setGrammar((rows) => rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  };
  const delG = (i: number) => {
    dirty();
    setDeleted((d) => ({ ...d, grammar: [...d.grammar, grammar[i].id] }));
    setGrammar((rows) => rows.filter((_, j) => j !== i));
  };

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
      dirty();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const grade = meta.grade ? Number(meta.grade) : null;

  // položky, na ktoré sa dá v prompte odvolať kódom, a čo už lekcia obsahuje
  const known = [
    ...vocab.filter((r) => r.code).map((r) => ({ code: r.code!, kind: "vocab" as const, text: `${r.en} – ${r.sk}` })),
    ...grammar.filter((r) => r.code).map((r) => ({ code: r.code!, kind: "grammar" as const, text: `${r.prompt} → ${r.answer}` })),
    ...texts.filter((r) => r.code).map((r) => ({ code: r.code!, kind: "text" as const, text: r.title || "text" })),
  ];
  const aiCtx = { ai, grade, title: meta.title, known, disabled: !!busy };

  /** Čo z AI prišlo späť, prepíšeme do riadkov editora; uloží sa až s lekciou. */
  const vRowFrom = (x: Record<string, unknown>, base?: VRow): VRow => ({
    ...(base ?? emptyV()),
    en: String(x.en ?? base?.en ?? ""),
    sk: String(x.sk ?? base?.sk ?? ""),
    example_en: String(x.example_en ?? base?.example_en ?? ""),
    example_sk: String(x.example_sk ?? base?.example_sk ?? ""),
    emoji: String(x.emoji ?? base?.emoji ?? ""),
  });
  const gRowFrom = (x: Record<string, unknown>, base?: GRow): GRow => ({
    ...(base ?? emptyG()),
    prompt: String(x.prompt ?? base?.prompt ?? ""),
    answer: String(x.answer ?? base?.answer ?? ""),
    options: Array.isArray(x.options) ? (x.options as string[]).join(", ") : String(x.options ?? base?.options ?? ""),
    translation_sk: String(x.translation_sk ?? base?.translation_sk ?? ""),
    explanation_sk: String(x.explanation_sk ?? base?.explanation_sk ?? ""),
  });

  /** Writes the lesson and all its items; returns the lesson id. */
  async function persist(snap: Snapshot): Promise<string> {
    const sb = supabase();
    const isNew = !idRef.current;
    const id = idRef.current ?? uid();
    const lr = await sb.from("lessons").upsert({
      id,
      title: snap.meta.title.trim(),
      textbook: snap.meta.textbook.trim() || null,
      unit: snap.meta.unit.trim() || null,
      grade: snap.meta.grade ? Number(snap.meta.grade) : null,
      notes: snap.meta.notes.trim() || null,
    });
    if (lr.error) throw lr.error;
    try {
      if (snap.meta.grade) localStorage.setItem(LAST_GRADE, snap.meta.grade);
    } catch {}
    if (isNew) {
      setLessonId(id);
      router.replace(`/rodic/anglictina/lekcia?id=${id}`);
    }
    const ops = [];
    const d = snap.deleted;
    if (d.vocab.length) ops.push(sb.from("vocab_items").delete().in("id", d.vocab));
    if (d.grammar.length) ops.push(sb.from("grammar_items").delete().in("id", d.grammar));
    if (d.texts.length) ops.push(sb.from("lesson_texts").delete().in("id", d.texts));
    const v = snap.vocab
      .filter((r) => r.en.trim() && r.sk.trim())
      .map((r, i) => ({
        id: r.id,
        lesson_id: id,
        en: r.en.trim(),
        sk: r.sk.trim(),
        example_en: r.example_en.trim() || null,
        example_sk: r.example_sk.trim() || null,
        emoji: r.emoji.trim() || null,
        position: i,
        source_id: r.source_id,
      }));
    const g = snap.grammar
      .filter((r) => r.prompt.trim() && r.answer.trim())
      .map((r, i) => {
        const opts = r.options
          .split(/[,;]/)
          .map((o) => o.trim())
          .filter(Boolean);
        const answer = r.answer.trim();
        const first = answer.split("|")[0].trim();
        if (opts.length && !opts.some((o) => o.toLowerCase() === first.toLowerCase())) opts.push(first);
        return {
          id: r.id,
          lesson_id: id,
          prompt: r.prompt.trim(),
          answer,
          options: opts,
          translation_sk: r.translation_sk.trim() || null,
          explanation_sk: r.explanation_sk.trim() || null,
          position: i,
          source_id: r.source_id,
        };
      });
    const t = snap.texts
      .map((r, i) => ({
        id: r.id,
        lesson_id: id,
        title: r.title.trim() || null,
        sentences: r.sentences.filter((s) => s.en.trim()).map((s) => ({ id: s.id, en: s.en.trim(), sk: s.sk.trim() })),
        uses: r.uses,
        position: i,
        source_id: r.source_id,
      }))
      .filter((r) => r.sentences.length);
    // texts that ended up empty must not linger in the database
    const emptyTexts = snap.texts.filter((r) => !r.sentences.some((s) => s.en.trim())).map((r) => r.id);
    if (emptyTexts.length) ops.push(sb.from("lesson_texts").delete().in("id", emptyTexts));
    if (v.length) ops.push(sb.from("vocab_items").upsert(v));
    if (g.length) ops.push(sb.from("grammar_items").upsert(g));
    if (t.length) ops.push(sb.from("lesson_texts").upsert(t));
    const results = await Promise.all(ops);
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
    setDeleted(noDeleted);
    setSaved(true);
    return id;
  }

  async function save() {
    if (!meta.title.trim()) {
      setError("Zadaj názov lekcie.");
      return;
    }
    if (!meta.grade) {
      setError("Vyber triedu, pre ktorú je lekcia.");
      return;
    }
    setBusy("Ukladám…");
    setError(null);
    try {
      await persist({ meta, vocab, grammar, texts, deleted });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Uloženie zlyhalo.");
    } finally {
      setBusy(null);
    }
  }

  /** Photos need a saved lesson to attach their exercises to. */
  async function ensureLesson(): Promise<string> {
    if (idRef.current) return idRef.current;
    if (!meta.grade) throw new Error("Najprv vyber triedu lekcie.");
    let m = meta;
    if (!m.title.trim()) {
      autoTitle.current = true;
      m = { ...m, title: `Nová lekcia ${new Date().toLocaleDateString("sk-SK")}` };
      setMeta(m);
    }
    return persist({ meta: m, vocab, grammar, texts, deleted });
  }

  async function onPage(page: number, r: PageResult, id: string) {
    const sb = supabase();
    if (autoTitle.current && r.title) {
      autoTitle.current = false;
      const title = r.title;
      setMeta((m) => ({ ...m, title, unit: m.unit || r.unit }));
      await sb
        .from("lessons")
        .update({ title, ...(r.unit ? { unit: r.unit } : {}) })
        .eq("id", id);
    }
    if (!r.exercises.length) return;
    const rows = r.exercises.map((e, i) => ({
      lesson_id: id,
      page,
      label: e.label || null,
      instruction: e.instruction || null,
      content: e.text || e.instruction,
      note: e.note || null,
      types: e.suggested,
      suggested: e.suggested,
      position: i,
    }));
    const { data, error } = await sb.from("lesson_sources").insert(rows).select("*");
    if (error) throw error;
    setSources((prev) => sortSources([...prev, ...((data ?? []) as LessonSource[])]));
  }

  const importer = usePageImport({ ensureLesson, grade, lastPage: () => Math.max(0, ...sources.map((s) => s.page)), onPage });

  function setSourceTypes(id: string, types: SourceType[]) {
    setNote(null);
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, types } : s)));
    supabase()
      .from("lesson_sources")
      .update({ types })
      .eq("id", id)
      .then(({ error }) => error && setError(`Typ sa neuložil: ${error.message}`));
  }

  /** Generate practice items for every exercise whose types changed, replace its old items and save. */
  async function createFromSources() {
    const targets = sources.filter(isPending);
    if (!targets.length) return;
    setError(null);
    setNote(null);
    setBuildErrors({});
    let done = 0;
    setBusy(`Tvorím cvičenia 0 / ${targets.length}…`);
    const results = new Map<string, { types: SourceType[]; data: BuildResult | null }>();
    const errs: Record<string, string> = {};
    await pool(targets, 3, async (src) => {
      try {
        const eff = effective(src.types);
        const data = eff.length ? await buildFromSource({ label: src.label, instruction: src.instruction, content: src.content, types: eff }, grade) : null;
        results.set(src.id, { types: src.types, data });
      } catch (e) {
        errs[src.id] = e instanceof Error ? e.message : "Neznáma chyba";
      } finally {
        done++;
        setBusy(`Tvorím cvičenia ${done} / ${targets.length}…`);
      }
    });
    setBuildErrors(errs);
    if (!results.size) {
      setBusy(null);
      setError("Cvičenia sa nepodarilo vytvoriť. Skús to znova.");
      return;
    }

    // replace the previous items of these exercises with the new ones
    const ids = new Set(results.keys());
    const old = (r: { source_id: string | null }) => !!r.source_id && ids.has(r.source_id);
    // same word / sentence / gap-fill again keeps its id, so the child's progress and problem questions stay linked
    const oldVocab = new Map(vocab.filter(old).map((r) => [normalize(r.en), r.id]));
    const oldGrammar = new Map(grammar.filter(old).map((r) => [normalize(r.prompt), r.id]));
    const oldSentences = new Map(
      texts
        .filter(old)
        .flatMap((t) => t.sentences)
        .map((x) => [normalize(x.en), x.id]),
    );
    const reuse = (m: Map<string, string>, key: string) => {
      const id = m.get(key);
      if (id) m.delete(key);
      return id ?? uid();
    };
    const keepIds = (list: Sentence[]) => withIds(list).map((x) => ({ ...x, id: reuse(oldSentences, normalize(x.en)) }));
    const nv = vocab.filter((r) => !old(r) && (r.en.trim() || r.sk.trim()));
    const ng = grammar.filter((r) => !old(r));
    const nt = texts.filter((r) => !old(r));
    const known = new Set(nv.map((r) => normalize(r.en)));
    const added = { v: 0, g: 0, t: 0, w: 0 };
    for (const src of targets) {
      const res = results.get(src.id)?.data;
      if (!res) continue;
      const name = src.label ? `Cvičenie ${src.label}` : "Cvičenie";
      for (const v of res.vocab) {
        const key = normalize(v.en);
        if (known.has(key)) continue;
        known.add(key);
        nv.push({
          ...emptyV(),
          id: reuse(oldVocab, key),
          en: v.en,
          sk: v.sk,
          example_en: v.example_en ?? "",
          example_sk: v.example_sk ?? "",
          emoji: v.emoji ?? "",
          source_id: src.id,
        });
        added.v++;
      }
      for (const g of res.grammar) {
        ng.push({
          ...emptyG(),
          id: reuse(oldGrammar, normalize(g.prompt)),
          prompt: g.prompt,
          answer: g.answer,
          options: (g.options ?? []).join(", "),
          translation_sk: g.translation_sk ?? "",
          explanation_sk: g.explanation_sk ?? "",
          source_id: src.id,
        });
        added.g++;
      }
      const uses = (["reading", "listening"] as const).filter((u) => src.types.includes(u));
      if (res.text?.sentences.length && uses.length) {
        nt.push({ id: uid(), title: res.text.title || name, sentences: keepIds(res.text.sentences), uses: [...uses], source_id: src.id });
        added.t++;
      }
      if (res.writing.length) {
        nt.push({ id: uid(), title: `${name}: vety na písanie`, sentences: keepIds(res.writing), uses: ["writing"], source_id: src.id });
        added.w += res.writing.length;
      }
    }
    const kept = new Set([...nv, ...ng].map((r) => r.id));
    const nextDeleted: Deleted = {
      vocab: [...deleted.vocab, ...vocab.filter(old).map((r) => r.id)].filter((id) => !kept.has(id)),
      grammar: [...deleted.grammar, ...grammar.filter(old).map((r) => r.id)].filter((id) => !kept.has(id)),
      texts: [...deleted.texts, ...texts.filter(old).map((r) => r.id)],
    };
    setVocab(nv);
    setGrammar(ng);
    setTexts(nt);
    setDeleted(nextDeleted);

    try {
      setBusy("Ukladám…");
      await persist({ meta, vocab: nv, grammar: ng, texts: nt, deleted: nextDeleted });
      const now = new Date().toISOString();
      const sb = supabase();
      const marks = await Promise.all(
        [...results.entries()].map(([id, r]) => sb.from("lesson_sources").update({ applied_types: r.types, applied_at: now }).eq("id", id)),
      );
      const failed = marks.find((m) => m.error);
      if (failed?.error) throw failed.error;
      setSources((prev) => prev.map((s) => (results.has(s.id) ? { ...s, applied_types: results.get(s.id)!.types, applied_at: now } : s)));
      const made = madeSummary(added.v, added.g, added.t, added.w);
      const fails = Object.keys(errs).length;
      setNote(
        `${made ? `Pridané: ${made}.` : "Hotovo."} Lekcia je uložená.${fails ? ` ${fails} ${pl(fails, "cvičenie sa nepodarilo", "cvičenia sa nepodarilo", "cvičení sa nepodarilo")} vytvoriť, skús znova.` : ""}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Uloženie zlyhalo.");
    } finally {
      setBusy(null);
    }
  }

  async function enrich() {
    const targets = vocab.filter((v) => v.en && v.sk && (!v.example_en || !v.example_sk || !v.emoji));
    if (!targets.length) return;
    await run("Dopĺňam vety a obrázky…", async () => {
      const r = await enrichVocab(
        targets.map(({ en, sk, example_en, example_sk, emoji }) => ({ en, sk, example_en, example_sk, emoji })),
        grade,
      );
      setVocab((rows) =>
        rows.map((row) => {
          const hit = r.items.find((x) => x.en.trim().toLowerCase() === row.en.trim().toLowerCase());
          if (!hit) return row;
          return {
            ...row,
            example_en: row.example_en || hit.example_en || "",
            example_sk: row.example_sk || hit.example_sk || "",
            emoji: row.emoji || hit.emoji || "",
          };
        }),
      );
    });
  }

  async function genGrammar() {
    if (!topic.trim()) return;
    await run("Tvorím gramatické cvičenia…", async () => {
      const r = await generateGrammar(topic, vocab.map((v) => v.en).filter(Boolean), 8, grade);
      setGrammar((rows) => [
        ...rows,
        ...r.items.map((g) => ({
          ...emptyG(),
          prompt: g.prompt,
          answer: g.answer,
          options: (g.options ?? []).join(", "),
          translation_sk: g.translation_sk ?? "",
          explanation_sk: g.explanation_sk ?? "",
        })),
      ]);
    });
  }

  async function addText() {
    const sentences = splitSentences(textPaste);
    if (!sentences.length) return;
    const row: TRow = { id: uid(), title: "", sentences: sentences.map((en) => ({ id: uid(), en, sk: "" })), uses: ["reading", "listening"], source_id: null };
    setTexts((t) => [...t, row]);
    setTextPaste("");
    dirty();
    if (ai) {
      await run("Prekladám text…", async () => {
        const r = await translateSentences(sentences);
        setTexts((t) => t.map((x) => (x.id === row.id ? { ...x, sentences: x.sentences.map((s, i) => ({ ...s, sk: r.sentences[i]?.sk ?? s.sk })) } : x)));
      });
    }
  }

  async function removeLesson() {
    if (!lessonId || !confirm("Zmazať celú lekciu? Pokrok detí pri jej slovíčkach sa tiež stratí.")) return;
    await supabase().from("lessons").delete().eq("id", lessonId);
    router.push("/rodic/anglictina");
  }

  if (loading) return <Spinner />;
  const missingExtras = vocab.filter((v) => v.en && v.sk && (!v.example_en || !v.emoji)).length;
  const pending = sources.filter(isPending).length;
  const pages = [...new Set(sources.map((s) => s.page))];
  const sourceLabel = new Map(sources.map((s) => [s.id, `${s.label ? `cvičenie ${s.label}` : "cvičenie"}, strana ${s.page}`]));
  const madeFor = (id: string) =>
    madeSummary(
      vocab.filter((r) => r.source_id === id).length,
      grammar.filter((r) => r.source_id === id).length,
      texts.filter((r) => r.source_id === id && !r.uses.includes("writing")).length,
      texts.filter((r) => r.source_id === id && r.uses.includes("writing")).reduce((n, r) => n + r.sentences.length, 0),
    );
  const working = !!busy || importer.active;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <Link href="/rodic/anglictina" className="inline-flex items-center gap-1 text-sm font-bold text-slate hover:text-ink">
        <ArrowLeft className="size-4" /> Lekcie
      </Link>

      <Card className="p-5 sm:p-6 space-y-4">
        <h1 className="text-2xl font-black">{lessonId ? "Upraviť lekciu" : "Nová lekcia"}</h1>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Názov lekcie">
            <Input value={meta.title} onChange={(e) => setM({ title: e.target.value })} placeholder="napr. Unit 3 – My family" />
          </Field>
          <Field label="Učebnica">
            <Input value={meta.textbook} onChange={(e) => setM({ textbook: e.target.value })} placeholder="napr. Headway" />
          </Field>
          <Field label="Kapitola / unit">
            <Input value={meta.unit} onChange={(e) => setM({ unit: e.target.value })} placeholder="napr. 3B" />
          </Field>
          <Field label="Trieda" hint="Žiak uvidí lekciu po výbere tejto triedy.">
            <select
              value={meta.grade}
              onChange={(e) => setM({ grade: e.target.value })}
              className={cx("w-full h-11 rounded-xl border-2 bg-card px-3 font-semibold", meta.grade ? "border-line" : "border-sun-deep")}
            >
              <option value="">Vyber triedu</option>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {gradeLabel(g)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "sources", label: `Z učebnice (${sources.length})` },
          { value: "vocab", label: `Slovíčka (${vocab.filter((v) => v.en).length})` },
          { value: "grammar", label: `Gramatika (${grammar.length})` },
          { value: "texts", label: `Texty a vety (${texts.length})` },
          ...(lessonId ? [{ value: "problems" as const, label: `Problémové otázky${problemCount ? ` (${problemCount})` : ""}` }] : []),
        ]}
      />

      {busy && (
        <div className="rounded-2xl bg-sky-soft text-sky font-bold px-4 py-3 flex items-center gap-2" role="status">
          <Sparkles className="size-4 animate-pulse" /> {busy}
        </div>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
      {note && !busy && (
        <div className="rounded-2xl bg-leaf-soft text-leaf font-bold px-4 py-3 flex items-start gap-2" role="status">
          <Check className="size-5 shrink-0" /> {note}
        </div>
      )}

      {tab === "sources" && (
        <div className="space-y-6">
          <UploadPanel hasSources={sources.length > 0} ai={ai} disabled={!!busy || !meta.grade} importer={importer} />
          {!meta.grade && <p className="text-sm font-bold text-sun-deep -mt-3">Najprv hore vyber triedu lekcie.</p>}
          {pages.map((p) => {
            const list = sources.filter((s) => s.page === p);
            return (
              <section key={p} className="space-y-3" aria-label={`Strana ${p}`}>
                <h2 className="text-lg font-black">
                  Strana {p}{" "}
                  <span className="text-sm font-bold text-slate">
                    · {list.length} {pl(list.length, "cvičenie", "cvičenia", "cvičení")}
                  </span>
                </h2>
                {list.map((s) => (
                  <SourceCard key={s.id} src={s} made={madeFor(s.id)} error={buildErrors[s.id]} disabled={!!busy} onTypes={(t) => setSourceTypes(s.id, t)} />
                ))}
              </section>
            );
          })}
        </div>
      )}

      {tab === "vocab" && (
        <Card className="p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setPaste(paste === null ? "" : null)}>
              <ClipboardPaste className="size-4" /> Vložiť zoznam
            </Button>
            {ai && (
              <Button size="sm" variant="outline" onClick={enrich} disabled={!missingExtras || !!busy}>
                <Sparkles className="size-4" /> Doplniť vety a obrázky ({missingExtras})
              </Button>
            )}
          </div>
          {paste !== null && (
            <div className="rounded-2xl bg-paper p-3 space-y-2">
              <p className="text-sm text-slate">
                Jedno slovíčko na riadok: <b>apple - jablko</b>. Môžeš vložiť aj stĺpce z Excelu (EN, SK, veta EN, veta SK).
              </p>
              <Textarea rows={5} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"dog - pes\ncat - mačka"} />
              <Button
                size="sm"
                onClick={() => {
                  const rows = parseList(paste);
                  setVocab((v) => [...v.filter((x) => x.en || x.sk), ...rows]);
                  setPaste(null);
                  dirty();
                }}
              >
                <Plus className="size-4" /> Pridať {parseList(paste).length} slovíčok
              </Button>
            </div>
          )}
          <div className="hidden sm:grid grid-cols-[1fr_1fr_56px_36px] gap-2 px-1 text-xs font-bold text-slate">
            <span>Anglicky</span>
            <span>Slovensky</span>
            <span>Obrázok</span>
            <span />
          </div>
          <div className="space-y-3">
            {vocab.map((r, i) => (
              <div key={r.id} className="rounded-2xl border border-line p-2 sm:p-2.5 space-y-2">
                <AiPanel
                  kind="vocab"
                  code={r.code}
                  label={r.en || "slovíčko"}
                  {...aiCtx}
                  target={{ en: r.en, sk: r.sk, example_en: r.example_en, example_sk: r.example_sk, emoji: r.emoji }}
                  existing={vocab.filter((x) => x.en).map((x) => x.en)}
                  onFixed={(f: Record<string, unknown>) => {
                    setVocab((rows) => rows.map((x, j) => (j === i ? vRowFrom(f, x) : x)));
                    dirty();
                  }}
                  onAdd={(items: Record<string, unknown>[]) => {
                    setVocab((rows) => [...rows, ...items.map((x) => vRowFrom(x))]);
                    dirty();
                  }}
                />
                <div className="grid grid-cols-[1fr_1fr_48px_36px] sm:grid-cols-[1fr_1fr_56px_36px] gap-2">
                  <Input value={r.en} onChange={(e) => updV(i, "en", e.target.value)} placeholder="apple" autoCapitalize="off" aria-label="Anglicky" />
                  <Input value={r.sk} onChange={(e) => updV(i, "sk", e.target.value)} placeholder="jablko" aria-label="Slovensky" />
                  <Input value={r.emoji} onChange={(e) => updV(i, "emoji", e.target.value)} placeholder="🍎" className="text-center px-1" aria-label="Emoji" />
                  <button type="button" onClick={() => delV(i)} className="text-mist hover:text-tomato" aria-label="Zmazať slovíčko">
                    <X className="size-5 mx-auto" />
                  </button>
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  <Input
                    value={r.example_en}
                    onChange={(e) => updV(i, "example_en", e.target.value)}
                    placeholder="Veta: I eat an apple."
                    className="h-9 text-sm font-normal"
                    aria-label="Veta anglicky"
                  />
                  <Input
                    value={r.example_sk}
                    onChange={(e) => updV(i, "example_sk", e.target.value)}
                    placeholder="Preklad: Jem jablko."
                    className="h-9 text-sm font-normal"
                    aria-label="Veta slovensky"
                  />
                </div>
              </div>
            ))}
          </div>
          <Button variant="ghost" onClick={() => setVocab((v) => [...v, emptyV()])}>
            <Plus className="size-4" /> Pridať slovíčko
          </Button>
        </Card>
      )}

      {tab === "grammar" && (
        <Card className="p-4 sm:p-5 space-y-3">
          <p className="text-sm text-slate">
            Vetu napíš s medzerou <b>___</b> na mieste, ktoré dieťa doplní. Viac správnych odpovedí oddeľ znakom <b>|</b>, možnosti na výber čiarkou.
          </p>
          {ai && (
            <div className="flex flex-wrap gap-2 rounded-2xl bg-paper p-3">
              <Input
                className="flex-1 min-w-48"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Téma, napr. present simple, have got, there is/are"
              />
              <Button size="md" variant="outline" onClick={genGrammar} disabled={!topic.trim() || !!busy}>
                <Sparkles className="size-4" /> Vytvoriť 8 cvičení
              </Button>
            </div>
          )}
          {grammar.map((r, i) => (
            <div key={r.id} className="rounded-2xl border border-line p-3 space-y-2">
              <AiPanel
                kind="grammar"
                code={r.code}
                label={r.prompt || "cvičenie"}
                {...aiCtx}
                topic={topic}
                target={{ prompt: r.prompt, answer: r.answer, options: r.options, translation_sk: r.translation_sk, explanation_sk: r.explanation_sk }}
                existing={grammar.filter((x) => x.prompt).map((x) => x.prompt)}
                onFixed={(f: Record<string, unknown>) => {
                  setGrammar((rows) => rows.map((x, j) => (j === i ? gRowFrom(f, x) : x)));
                  dirty();
                }}
                onAdd={(items: Record<string, unknown>[]) => {
                  setGrammar((rows) => [...rows, ...items.map((x) => gRowFrom(x))]);
                  dirty();
                }}
              />
              <div className="flex gap-2">
                <Input value={r.prompt} onChange={(e) => updG(i, "prompt", e.target.value)} placeholder="She ___ got a cat." aria-label="Veta s medzerou" />
                <button type="button" onClick={() => delG(i)} className="text-mist hover:text-tomato px-1" aria-label="Zmazať cvičenie">
                  <X className="size-5" />
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                <Input value={r.answer} onChange={(e) => updG(i, "answer", e.target.value)} placeholder="Správne: has" aria-label="Správna odpoveď" />
                <Input value={r.options} onChange={(e) => updG(i, "options", e.target.value)} placeholder="Možnosti: has, have, is" aria-label="Možnosti" />
                <Input
                  value={r.translation_sk}
                  onChange={(e) => updG(i, "translation_sk", e.target.value)}
                  placeholder="Preklad: Ona má mačku."
                  className="text-sm font-normal"
                  aria-label="Preklad"
                />
                <Input
                  value={r.explanation_sk}
                  onChange={(e) => updG(i, "explanation_sk", e.target.value)}
                  placeholder="Vysvetlenie: he/she/it → has"
                  className="text-sm font-normal"
                  aria-label="Vysvetlenie"
                />
              </div>
              {r.source_id && sourceLabel.has(r.source_id) && <p className="text-xs text-mist font-semibold">Z učebnice: {sourceLabel.get(r.source_id)}</p>}
            </div>
          ))}
          <Button variant="ghost" onClick={() => setGrammar((g) => [...g, emptyG()])}>
            <Plus className="size-4" /> Pridať cvičenie
          </Button>
        </Card>
      )}

      {tab === "problems" && lessonId && <ProblemsPanel lessonId={lessonId} onCount={setProblemCount} />}

      {tab === "texts" && (
        <Card className="p-4 sm:p-5 space-y-4">
          <p className="text-sm text-slate">
            Texty a vety z učebnice. Pri každom zvoľ, na čo sa použije: čítanie po vetách, počúvanie (appka prečíta vetu a preklad) alebo písanie viet (dieťa
            skladá vetu zo slov).
          </p>
          <div className="rounded-2xl bg-paper p-3 space-y-2">
            <Textarea rows={4} value={textPaste} onChange={(e) => setTextPaste(e.target.value)} placeholder="Vlož anglický text…" />
            <Button size="sm" onClick={addText} disabled={!textPaste.trim() || !!busy}>
              <Plus className="size-4" /> Pridať text {ai ? "a preložiť" : ""}
            </Button>
          </div>
          {texts.map((t, ti) => (
            <div key={t.id} className="rounded-2xl border border-line p-3 space-y-2">
              <AiPanel
                kind="text"
                code={t.code}
                label={t.title || "text"}
                {...aiCtx}
                target={{ title: t.title, sentences: t.sentences.map((x) => ({ en: x.en, sk: x.sk })) }}
                existing={texts.map((x) => x.title).filter(Boolean)}
                onFixed={(f: Record<string, unknown>) => {
                  const sent = Array.isArray(f.sentences) ? (f.sentences as { en?: string; sk?: string }[]) : [];
                  setTexts((x) =>
                    x.map((r, j) =>
                      j === ti
                        ? { ...r, title: String(f.title ?? r.title), sentences: withIds(sent.map((v) => ({ en: String(v.en ?? ""), sk: String(v.sk ?? "") }))) }
                        : r,
                    ),
                  );
                  dirty();
                }}
                onAdd={() => {}}
              />
              <div className="flex gap-2">
                <Input
                  value={t.title}
                  onChange={(e) => setT((x) => x.map((r, j) => (j === ti ? { ...r, title: e.target.value } : r)))}
                  placeholder="Názov textu"
                />
                <button
                  type="button"
                  className="text-mist hover:text-tomato px-1"
                  aria-label="Zmazať text"
                  onClick={() => {
                    dirty();
                    setDeleted((d) => ({ ...d, texts: [...d.texts, t.id] }));
                    setTexts((x) => x.filter((_, j) => j !== ti));
                  }}
                >
                  <Trash2 className="size-5" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-slate mr-1">Použiť na:</span>
                {USES.map((u) => {
                  const on = t.uses.includes(u.value);
                  return (
                    <button
                      key={u.value}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setT((x) =>
                          x.map((r, j) => {
                            if (j !== ti) return r;
                            const uses = on ? r.uses.filter((v) => v !== u.value) : [...r.uses, u.value];
                            return { ...r, uses: uses.length ? uses : r.uses };
                          }),
                        )
                      }
                      className={cx(
                        "h-8 px-3 rounded-full border-2 text-sm font-bold transition-colors",
                        on ? "bg-sky text-white border-sky" : "bg-card border-line text-ink-soft hover:border-mist",
                      )}
                    >
                      {u.label}
                    </button>
                  );
                })}
              </div>
              {t.sentences.map((s, si) => (
                <div key={s.id} className="grid sm:grid-cols-2 gap-2">
                  {(["en", "sk"] as const).map((k) => (
                    <Input
                      key={k}
                      value={s[k]}
                      className="text-sm font-normal"
                      placeholder={k === "en" ? "Anglická veta" : "Slovenský preklad"}
                      onChange={(e) =>
                        setT((x) =>
                          x.map((r, j) => (j === ti ? { ...r, sentences: r.sentences.map((q, qi) => (qi === si ? { ...q, [k]: e.target.value } : q)) } : r)),
                        )
                      }
                    />
                  ))}
                </div>
              ))}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setT((x) => x.map((r, j) => (j === ti ? { ...r, sentences: [...r.sentences, { id: uid(), en: "", sk: "" }] } : r)))}
                >
                  <Plus className="size-4" /> Pridať vetu
                </Button>
                {t.source_id && sourceLabel.has(t.source_id) && (
                  <span className="text-xs text-mist font-semibold">Z učebnice: {sourceLabel.get(t.source_id)}</span>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}

      <div className="flex gap-3 sticky bottom-20 md:bottom-4 z-10">
        {tab === "sources" && pending > 0 ? (
          <Button size="lg" variant="sun" className="flex-1 shadow-lg" onClick={createFromSources} disabled={working}>
            <Wand2 className="size-5" /> Vytvoriť cvičenia ({pending})
          </Button>
        ) : (
          <Button
            size="lg"
            className={cx("flex-1 shadow-lg", saved && "!bg-leaf")}
            onClick={save}
            loading={busy === "Ukladám…"}
            disabled={working && busy !== "Ukladám…"}
          >
            {saved ? (
              <>
                <Check className="size-5" /> Uložené
              </>
            ) : (
              "Uložiť lekciu"
            )}
          </Button>
        )}
        {lessonId && (
          <Button size="lg" variant="danger" onClick={removeLesson} aria-label="Zmazať lekciu" disabled={working}>
            <Trash2 className="size-5" />
          </Button>
        )}
      </div>
    </div>
  );
}
