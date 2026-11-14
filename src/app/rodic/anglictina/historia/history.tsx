"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Card, cx, Segmented, Spinner } from "@/components/ui";
import { listChildren, listLessons, loadProblems, type LessonWithCounts } from "@/lib/en/data";
import { PROBLEM_TYPE_LABEL } from "@/lib/en/problems";
import { supabase } from "@/lib/supabase";
import type { Child, ProblemItem, SessionRow } from "@/lib/en/types";

function fmtDuration(sec?: number) {
  if (!sec) return "–";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m} min ${s} s` : `${s} s`;
}

export default function History() {
  const focus = useSearchParams().get("hodina");
  const [children, setChildren] = useState<Child[] | null>(null);
  const [childId, setChildId] = useState<string>("");
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [problems, setProblems] = useState<ProblemItem[]>([]);
  const [lessons, setLessons] = useState<LessonWithCounts[]>([]);
  const [open, setOpen] = useState<string | null>(focus);

  useEffect(() => {
    listChildren().then((c) => {
      setChildren(c);
      if (c[0]) setChildId(c[0].id);
    });
    listLessons()
      .then(setLessons)
      .catch(() => setLessons([]));
  }, []);

  useEffect(() => {
    if (!childId) return;
    const sb = supabase();
    (async () => {
      const [s, p] = await Promise.all([
        sb.from("sessions").select("*").eq("child_id", childId).not("ended_at", "is", null).order("started_at", { ascending: false }).limit(50),
        loadProblems(childId, { openOnly: true }),
      ]);
      setSessions((s.data ?? []) as SessionRow[]);
      setProblems(p.sort((a, b) => b.wrong_count - a.wrong_count));
    })();
  }, [childId]);

  const totals = useMemo(() => {
    const t = sessions.reduce((a, s) => ({ total: a.total + s.total, correct: a.correct + s.correct, sec: a.sec + (s.summary?.durationSec ?? 0) }), {
      total: 0,
      correct: 0,
      sec: 0,
    });
    return { ...t, pct: t.total ? Math.round((t.correct / t.total) * 100) : 0 };
  }, [sessions]);

  if (!children) return <Spinner />;
  if (!children.length) return <p className="text-slate">Zatiaľ žiadne deti.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">História</h1>
        {children.length > 1 && (
          <Segmented value={childId} onChange={setChildId} options={children.map((c) => ({ value: c.id, label: `${c.avatar} ${c.name}` }))} />
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-xs font-bold text-slate">Tréningov</div>
          <div className="text-2xl font-black">{sessions.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-bold text-slate">Úspešnosť</div>
          <div className="text-2xl font-black">{totals.pct} %</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-bold text-slate">Čas spolu</div>
          <div className="text-2xl font-black">{Math.round(totals.sec / 60)} min</div>
        </Card>
      </div>

      <section>
        <h2 className="text-lg font-black mb-3">Nezvládnuté problémové otázky</h2>
        {problems.length === 0 ? (
          <Card className="p-5 text-slate">Žiadne. Otázky, s ktorými má dieťa problém, sa tu objavia po tréningu a budú sa mu vracať, kým ich nezvládne.</Card>
        ) : (
          <Card className="divide-y divide-line">
            {lessons
              .filter((l) => problems.some((p) => p.lesson_id === l.id))
              .map((l) => {
                const list = problems.filter((p) => p.lesson_id === l.id);
                return (
                  <div key={l.id} className="p-4 space-y-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-black">{l.title}</h3>
                      <Link href={`/rodic/anglictina/lekcia?id=${l.id}`} className="text-sm font-bold text-sky hover:underline shrink-0">
                        Otvoriť lekciu
                      </Link>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {list.map((p) => (
                        <span
                          key={p.id}
                          className="rounded-xl px-3 py-1.5 text-sm font-bold border bg-tomato-soft border-tomato/30 text-tomato"
                          title={PROBLEM_TYPE_LABEL[p.item_type]}
                        >
                          {p.label} <span className="opacity-60">×{p.wrong_count}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
          </Card>
        )}
      </section>

      <section>
        <h2 className="text-lg font-black mb-3">Hodiny</h2>
        {sessions.length === 0 ? (
          <Card className="p-5 text-slate">Zatiaľ žiadny dokončený tréning.</Card>
        ) : (
          <Card className="divide-y divide-line">
            {sessions.map((s) => {
              const pct = s.total ? Math.round((s.correct / s.total) * 100) : null;
              const isOpen = open === s.id;
              return (
                <div key={s.id}>
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-paper/60"
                    onClick={() => setOpen(isOpen ? null : s.id)}
                    aria-expanded={isOpen}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="font-bold block">
                        {new Date(s.started_at).toLocaleString("sk-SK", {
                          weekday: "long",
                          day: "numeric",
                          month: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="text-sm text-slate block truncate">
                        {s.summary?.lessonTitles?.join(", ")} · {fmtDuration(s.summary?.durationSec)}
                      </span>
                    </span>
                    {pct !== null && <span className={cx("font-black", pct >= 80 ? "text-leaf" : pct >= 50 ? "text-sun-deep" : "text-tomato")}>{pct} %</span>}
                    <ChevronDown className={cx("size-5 text-mist transition-transform", isOpen && "rotate-180")} />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 space-y-3">
                      <div className="grid sm:grid-cols-2 gap-2">
                        {(s.summary?.activities ?? []).map((a) => (
                          <div key={a.key} className="rounded-xl bg-paper px-3 py-2 flex justify-between text-sm">
                            <span className="font-bold">{a.label}</span>
                            <span>{a.total ? `${a.correct} / ${a.total}` : "hotovo"}</span>
                          </div>
                        ))}
                      </div>
                      {!!s.summary?.problems?.length && (
                        <div className="text-sm">
                          <span className="font-bold">Chyby v tomto tréningu: </span>
                          {s.summary.problems.map((w) => w.label).join(", ")}
                        </div>
                      )}
                      {!s.summary?.problems && !!s.summary?.problemWords?.length && (
                        <div className="text-sm">
                          <span className="font-bold">Chyby v tomto tréningu: </span>
                          {s.summary.problemWords.map((w) => `${w.en} (${w.sk})`).join(", ")}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        )}
      </section>
    </div>
  );
}
