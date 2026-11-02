"use client";

import { useEffect, useState } from "react";
import { ScoreChart } from "@/components/score-chart";
import { Card, Segmented, Spinner } from "@/components/ui";
import { subjectDef } from "@/data/subjects";
import { listChildren, loadSessions } from "@/lib/data";
import { typeLabel } from "@/lib/exercises";
import type { Child, SessionRow } from "@/lib/types";

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("sk-SK", { day: "numeric", month: "numeric" });

export default function History() {
  const [children, setChildren] = useState<Child[] | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [childId, setChildId] = useState("");

  useEffect(() => {
    listChildren().then((c) => {
      setChildren(c);
      setChildId(c[0]?.id ?? "");
    });
    loadSessions(undefined, undefined, 300).then(setSessions);
  }, []);

  if (!children) return <Spinner />;
  const mine = sessions.filter((s) => s.child_id === childId);
  const subjects = [...new Set(mine.map((s) => s.subject))];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black">História</h1>
      {children.length > 1 && (
        <Segmented value={childId} onChange={setChildId} options={children.map((c) => ({ value: c.id, label: `${c.avatar} ${c.name}` }))} />
      )}
      {mine.length === 0 ? (
        <Card className="p-6 text-center text-slate">Zatiaľ žiadne tréningy.</Card>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {subjects.map((sub) => {
              const rows = mine.filter((s) => s.subject === sub);
              const scores = [...rows].reverse().map((s) => s.score);
              return (
                <Card key={sub} className="p-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl">{subjectDef(sub)?.icon}</span>
                    <span className="font-black">{subjectDef(sub)?.name ?? sub}</span>
                    <span className="text-sm text-slate font-semibold ml-auto">
                      {rows.length} tréningov · posledný {rows[0].score} %
                    </span>
                  </div>
                  <ScoreChart scores={scores.slice(-20)} label={`Výsledky: ${scores.slice(-20).join(", ")} %`} />
                </Card>
              );
            })}
          </div>
          <Card className="p-4 overflow-x-auto">
            <h2 className="font-black mb-2">Tréningy</h2>
            <table className="w-full text-sm">
              <thead className="text-left text-slate">
                <tr>
                  <th className="py-1 pr-2">Dátum</th>
                  <th className="py-1 pr-2">Predmet</th>
                  <th className="py-1 pr-2">Skóre</th>
                  <th className="py-1">Typy cvičení</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {mine.map((s) => (
                  <tr key={s.id}>
                    <td className="py-1.5 pr-2 whitespace-nowrap">{dateLabel(s.created_at)}</td>
                    <td className="py-1.5 pr-2 font-bold whitespace-nowrap">
                      {subjectDef(s.subject)?.name ?? s.subject}
                      {s.mode === "focus" ? " · len chyby" : ""}
                    </td>
                    <td className="py-1.5 pr-2 font-black tabular-nums">
                      {s.score} %{" "}
                      <span className="text-slate font-semibold">
                        ({s.correct}/{s.planned})
                      </span>
                    </td>
                    <td className="py-1.5 text-slate">
                      {Object.entries(s.summary?.byType ?? {})
                        .map(([t, v]) => `${typeLabel(t)} ${v.correct}/${v.total}`)
                        .join(", ") || "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
