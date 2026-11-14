"use client";

import { supabase } from "@/lib/supabase";
import type { Child, GrammarItem, ItemProgress, Lesson, LessonText, ProblemItem, TextUse, VocabItem } from "./types";

export async function listChildren(): Promise<Child[]> {
  const { data, error } = await supabase().from("children").select("*").order("created_at");
  if (error) throw error;
  return (data ?? []) as Child[];
}

export async function getChild(id: string): Promise<Child | null> {
  const { data, error } = await supabase().from("children").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Child | null;
}

export type LessonWithCounts = Lesson & { vocab: number; grammar: number; texts: number; reading: number; listening: number; writing: number };

export async function listLessons(): Promise<LessonWithCounts[]> {
  const { data, error } = await supabase()
    .from("lessons")
    .select("*, vocab_items(count), grammar_items(count), lesson_texts(uses, sentences)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  type Row = Lesson & {
    vocab_items: { count: number }[];
    grammar_items: { count: number }[];
    lesson_texts: { uses: TextUse[] | null; sentences: unknown[] | null }[];
  };
  return ((data ?? []) as Row[]).map(({ vocab_items, grammar_items, lesson_texts, ...l }) => {
    const texts = lesson_texts ?? [];
    const uses = (u: TextUse) => texts.filter((t) => (t.uses ?? ["reading", "listening"]).includes(u));
    return {
      ...l,
      vocab: vocab_items?.[0]?.count ?? 0,
      grammar: grammar_items?.[0]?.count ?? 0,
      texts: texts.length,
      reading: uses("reading").length,
      listening: uses("listening").length,
      writing: uses("writing").reduce((n, t) => n + (t.sentences?.length ?? 0), 0),
    };
  });
}

export type LessonContent = { vocab: VocabItem[]; grammar: GrammarItem[]; texts: LessonText[] };

export async function loadContent(lessonIds: string[]): Promise<LessonContent> {
  if (!lessonIds.length) return { vocab: [], grammar: [], texts: [] };
  const sb = supabase();
  const [v, g, t] = await Promise.all([
    sb.from("vocab_items").select("*").in("lesson_id", lessonIds).order("position"),
    sb.from("grammar_items").select("*").in("lesson_id", lessonIds).order("position"),
    sb.from("lesson_texts").select("*").in("lesson_id", lessonIds).order("position"),
  ]);
  if (v.error) throw v.error;
  if (g.error) throw g.error;
  if (t.error) throw t.error;
  return { vocab: v.data as VocabItem[], grammar: g.data as GrammarItem[], texts: t.data as LessonText[] };
}

export async function loadProgress(childId: string): Promise<Map<string, ItemProgress>> {
  const { data, error } = await supabase().from("item_progress").select("*").eq("child_id", childId);
  if (error) throw error;
  return new Map((data as ItemProgress[]).map((p) => [p.item_id, p]));
}

/** Problem questions of a child, optionally only for some lessons. */
export async function loadProblems(childId: string, opts: { lessonIds?: string[]; openOnly?: boolean } = {}): Promise<ProblemItem[]> {
  let q = supabase().from("problem_items").select("*").eq("child_id", childId);
  if (opts.lessonIds) {
    if (!opts.lessonIds.length) return [];
    q = q.in("lesson_id", opts.lessonIds);
  }
  if (opts.openOnly) q = q.eq("mastered", false);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ProblemItem[];
}

export type ReviewItems = { vocab: VocabItem[]; grammar: GrammarItem[]; sentences: { id: string; en: string; sk: string; key: string; lesson_id: string }[] };

/** The actual questions behind problem items (items deleted since then are skipped). */
export async function loadReviewItems(problems: ProblemItem[]): Promise<ReviewItems> {
  const sb = supabase();
  const ids = (t: string) => problems.filter((p) => p.item_type === t).map((p) => p.item_id);
  const vIds = ids("vocab");
  const gIds = ids("grammar");
  const sIds = new Set(ids("sentence"));
  const sLessons = [...new Set(problems.filter((p) => p.item_type === "sentence").map((p) => p.lesson_id))];
  const [v, g, t] = await Promise.all([
    vIds.length ? sb.from("vocab_items").select("*").in("id", vIds) : Promise.resolve({ data: [] }),
    gIds.length ? sb.from("grammar_items").select("*").in("id", gIds) : Promise.resolve({ data: [] }),
    sLessons.length ? sb.from("lesson_texts").select("*").in("lesson_id", sLessons) : Promise.resolve({ data: [] }),
  ]);
  const sentences = ((t.data ?? []) as LessonText[]).flatMap((x) =>
    (x.sentences ?? []).filter((s) => s.id && sIds.has(s.id)).map((s) => ({ id: s.id!, en: s.en, sk: s.sk, key: s.id!, lesson_id: x.lesson_id })),
  );
  return { vocab: (v.data ?? []) as VocabItem[], grammar: (g.data ?? []) as GrammarItem[], sentences };
}

export function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

/** Koľko lekcií angličtina má — pre dlaždicu na rozcestníku. */
export async function countLessons(): Promise<number> {
  const { count } = await supabase().from("lessons").select("id", { count: "exact", head: true });
  return count ?? 0;
}
