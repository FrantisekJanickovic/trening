"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ScoreChart } from "@/components/score-chart";
import { Card, Spinner } from "@/components/ui";
import { subjectDef, type SubjectSlug } from "@/data/subjects";
import { getChild, loadSessions } from "@/lib/data";
import type { Child, SessionRow } from "@/lib/types";

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("sk-SK", { day: "numeric", month: "numeric" });

export default function Results() {
  const slug = String(useParams().slug) as SubjectSlug;
  const childId = useSearchParams().get("child") ?? "";
  const [child, setChild] = useState<Child | null>(null);
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);

  useEffect(() => {
    getChild(childId).then(setChild);
    loadSessions(slug, childId).then(setSessions);
  }, [slug, childId]);

  if (!child || !sessions) return <Spinner />;
  const scores = [...sessions].reverse().map((s) => s.score);
  const best = scores.length ? Math.max(...scores) : 0;

  return (
    <main className="flex-1 w-full max-w-xl mx-auto px-4 py-4 space-y-4">
      <header className="flex items-center gap-2">
        <Link
          href={`/predmet/${slug}?child=${childId}`}
          aria-label="Späť"
          className="size-10 -ml-2 inline-flex items-center justify-center rounded-xl hover:bg-ink/5"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <span className="text-3xl">{subjectDef(slug)?.icon}</span>
        <h1 className="font-black text-xl">Moje výsledky</h1>
      </header>

      {sessions.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="font-bold">Zatiaľ žiadne tréningy.</p>
          <p className="text-slate text-sm mt-1">Po prvom tréningu tu uvidíš, ako sa zlepšuješ.</p>
        </Card>
      ) : (
        <>
          <Card className="p-4">
            <p className="font-black">
              Posledný tréning: <span className="tabular-nums">{sessions[0].score} %</span>
            </p>
            <p className="text-sm text-slate font-semibold">
              {sessions.length} {sessions.length === 1 ? "tréning" : sessions.length < 5 ? "tréningy" : "tréningov"} · najlepšie {best} %
            </p>
            <ScoreChart scores={scores.slice(-15)} label={`Výsledky: ${scores.slice(-15).join(", ")} %`} />
          </Card>
          <Card className="p-4">
            <h2 className="font-black mb-2">Posledné tréningy</h2>
            <ul className="divide-y divide-line">
              {sessions.slice(0, 15).map((s) => (
                <li key={s.id} className="flex items-center gap-2 py-2">
                  <span className="text-sm text-slate font-semibold w-12">{dateLabel(s.created_at)}</span>
                  <span className="font-bold text-sm">{s.mode === "focus" ? "Len chyby" : "Tréning"}</span>
                  <span className="ml-auto font-black tabular-nums">{s.score} %</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </main>
  );
}
