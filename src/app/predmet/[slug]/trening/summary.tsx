"use client";

import { Star } from "lucide-react";
import { useMemo } from "react";
import { Button, Card, cx } from "@/components/ui";
import { typeLabel } from "@/lib/exercises";
import type { Child, SubjectSlug } from "@/lib/types";

export type SummaryData = {
  child: Child;
  subject: SubjectSlug;
  mode: "normal" | "focus";
  score: number;
  correct: number;
  total: number;
  wrong: { id: string; concept: string; preview: string }[];
  byType: Record<string, { total: number; correct: number }>;
  masteredNow: number;
  durationSec: number;
};

const stars = (s: number) => (s >= 90 ? 3 : s >= 70 ? 2 : s >= 50 ? 1 : 0);

function headline(score: number, name: string) {
  if (score === 100) return `Bez jedinej chyby, ${name}!`;
  if (score >= 90) return `Výborne, ${name}!`;
  if (score >= 70) return `Pekná práca, ${name}!`;
  if (score >= 50) return `Dobrý tréning, ${name}!`;
  return `Tréning je hotový, ${name}!`;
}

function Confetti() {
  const bits = useMemo(
    () => Array.from({ length: 28 }, (_, i) => ({ left: (i * 37) % 100, delay: (i % 7) * 90, color: ["#ffc83d", "#1f9d63", "#3d6cf0", "#e5484d"][i % 4] })),
    [],
  );
  return (
    <div className="confetti pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      {bits.map((b, i) => (
        <span key={i} className="absolute top-0 size-3 rounded-sm" style={{ left: `${b.left}%`, background: b.color, animationDelay: `${b.delay}ms` }} />
      ))}
    </div>
  );
}

export function Summary({ data, onAgain, onHome }: { data: SummaryData; onAgain: () => void; onHome: () => void }) {
  const n = stars(data.score);
  const min = Math.floor(data.durationSec / 60);
  const sec = data.durationSec % 60;
  return (
    <main className="flex-1 flex flex-col w-full max-w-xl mx-auto px-4 py-6 gap-5">
      {n >= 2 && <Confetti />}
      <div className="text-center anim-rise">
        <div className="text-6xl">{data.child.avatar}</div>
        <h1 className="text-2xl font-black mt-2">{headline(data.score, data.child.name)}</h1>
        <div className="flex justify-center gap-2 mt-3" aria-label={`${n} z 3 hviezd`}>
          {[0, 1, 2].map((i) => (
            <Star key={i} className={cx("size-11", i < n ? "fill-sun text-sun-deep anim-bounce" : "text-line")} style={{ animationDelay: `${i * 150}ms` }} />
          ))}
        </div>
        <p className="text-5xl font-black mt-3 tabular-nums">{data.score} %</p>
        <p className="text-slate font-semibold">
          Správne {data.correct} z {data.total} · {min ? `${min} min ` : ""}
          {sec} s
        </p>
      </div>

      {data.masteredNow > 0 && (
        <div className="rounded-2xl bg-leaf-soft text-leaf font-bold px-4 py-3 text-center anim-rise">
          {data.masteredNow === 1 ? "Jedno cvičenie, ktoré ti predtým nešlo, už vieš!" : `${data.masteredNow} cvičenia, ktoré ti predtým nešli, už vieš!`}
        </div>
      )}

      {Object.keys(data.byType).length > 1 && (
        <Card className="p-4">
          <h2 className="font-black mb-2">Podľa typu cvičenia</h2>
          <ul className="space-y-1 text-sm font-semibold">
            {Object.entries(data.byType).map(([t, s]) => (
              <li key={t} className="flex justify-between">
                <span>{typeLabel(t)}</span>
                <span className="tabular-nums text-slate">
                  {s.correct}/{s.total}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {data.wrong.length > 0 && (
        <Card className="p-4">
          <h2 className="font-black">Toto si ešte zopakujeme</h2>
          <ul className="mt-2 space-y-1.5">
            {data.wrong.map((w) => (
              <li key={w.id} className="text-sm">
                {w.concept && <span className="font-black">{w.concept}: </span>}
                <span className="text-slate">{w.preview}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-3 mt-auto">
        <Button size="xl" variant="sun" onClick={onAgain}>
          Trénovať znova
        </Button>
        <Button size="lg" variant="outline" onClick={onHome}>
          Späť na lekcie
        </Button>
      </div>
    </main>
  );
}
