"use client";

import { ArrowDown, ArrowUp, BookOpen, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonClass, Card, ErrorNote, Spinner } from "@/components/ui";
import { listLessons, type LessonWithCounts } from "@/lib/en/data";
import { orderLessons } from "@/lib/en/problems";
import { gradeLabel } from "@/lib/en/settings";
import { supabase } from "@/lib/supabase";

export default function LessonsPage() {
  const [lessons, setLessons] = useState<LessonWithCounts[] | null>(null);
  const [problems, setProblems] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [l, p] = await Promise.all([listLessons(), supabase().from("problem_items").select("lesson_id").eq("mastered", false)]);
      const counts: Record<string, number> = {};
      for (const r of (p.data ?? []) as { lesson_id: string }[]) counts[r.lesson_id] = (counts[r.lesson_id] ?? 0) + 1;
      setProblems(counts);
      setLessons(orderLessons(l));
    })().catch(() => setLessons([]));
  }, []);

  /** Swap a lesson with its neighbour within the same class; this order decides which lessons are "previous". */
  async function move(l: LessonWithCounts, delta: -1 | 1) {
    if (!lessons) return;
    const group = lessons.filter((x) => x.grade === l.grade);
    const i = group.findIndex((x) => x.id === l.id);
    const other = group[i + delta];
    if (!other) return;
    // give the group distinct positions first so a swap always changes the order
    const base = Math.min(...group.map((g) => g.position ?? 0));
    const positions = new Map(group.map((g, k) => [g.id, base + k]));
    positions.set(l.id, base + i + delta);
    positions.set(other.id, base + i);
    const next = orderLessons(lessons.map((x) => (positions.has(x.id) ? { ...x, position: positions.get(x.id)! } : x)));
    setLessons(next);
    setError(null);
    const sb = supabase();
    const res = await Promise.all(
      group.map((g) =>
        sb
          .from("lessons")
          .update({ position: positions.get(g.id) })
          .eq("id", g.id),
      ),
    );
    const failed = res.find((r) => r.error);
    if (failed?.error) setError(`Poradie sa neuložilo: ${failed.error.message}`);
  }

  if (!lessons) return <Spinner />;
  const grades = [...new Set(lessons.map((l) => l.grade ?? 0))];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-black">Lekcie</h1>
        <Link href="/rodic/anglictina/lekcia" className={buttonClass("primary", "sm")}>
          <Plus className="size-4" /> Nová lekcia
        </Link>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      {lessons.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-slate mb-4">Zatiaľ žiadne lekcie. Odfoť stranu z učebnice alebo prepíš slovíčka do formulára.</p>
          <Link href="/rodic/anglictina/lekcia" className={buttonClass("primary", "md")}>
            <Plus className="size-4" /> Pridať lekciu
          </Link>
        </Card>
      ) : (
        <>
          <p className="text-sm text-slate -mt-2 max-w-prose">
            Poradie v rámci triedy určuje, ktoré lekcie sú „predchádzajúce“. Z nich sa do tréningu pridávajú problémové otázky (nastavíš v Nastaveniach).
          </p>
          {grades.map((g) => {
            const group = lessons.filter((l) => (l.grade ?? 0) === g);
            return (
              <section key={g} aria-label={g ? gradeLabel(g) : "Bez triedy"} className="space-y-2">
                <h2 className="text-lg font-black">{g ? gradeLabel(g) : "Bez triedy"}</h2>
                <Card className="divide-y divide-line">
                  {group.map((l, i) => (
                    <div key={l.id} className="flex items-center gap-3 p-3 sm:p-4">
                      <span className="size-8 shrink-0 rounded-lg bg-paper font-black text-sm inline-flex items-center justify-center text-slate">{i + 1}</span>
                      <BookOpen className="size-5 text-sky shrink-0 hidden sm:block" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-black leading-tight truncate">{l.title}</h3>
                        <p className="text-sm text-slate truncate">
                          {[l.textbook, l.unit].filter(Boolean).join(" · ") || "Bez učebnice"} · {l.vocab} slovíčok · {l.grammar} gramatika · {l.texts} texty
                        </p>
                        {problems[l.id] ? (
                          <p className="text-xs font-black text-tomato mt-0.5">
                            {problems[l.id]} {problems[l.id] === 1 ? "problémová otázka" : problems[l.id] < 5 ? "problémové otázky" : "problémových otázok"}
                          </p>
                        ) : null}
                      </div>
                      {group.length > 1 && (
                        <div className="flex flex-col sm:flex-row">
                          <button
                            type="button"
                            onClick={() => move(l, -1)}
                            disabled={i === 0}
                            aria-label={`Posunúť ${l.title} vyššie`}
                            className="size-8 rounded-lg hover:bg-paper disabled:opacity-25 inline-flex items-center justify-center"
                          >
                            <ArrowUp className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => move(l, 1)}
                            disabled={i === group.length - 1}
                            aria-label={`Posunúť ${l.title} nižšie`}
                            className="size-8 rounded-lg hover:bg-paper disabled:opacity-25 inline-flex items-center justify-center"
                          >
                            <ArrowDown className="size-4" />
                          </button>
                        </div>
                      )}
                      <Link href={`/rodic/anglictina/lekcia?id=${l.id}`} className={buttonClass("outline", "sm")} aria-label={`Upraviť ${l.title}`}>
                        <Pencil className="size-4" /> <span className="hidden sm:inline">Upraviť</span>
                      </Link>
                    </div>
                  ))}
                </Card>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
