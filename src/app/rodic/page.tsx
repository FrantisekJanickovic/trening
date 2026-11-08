"use client";

import { BookOpen, Pencil, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, Spinner, Toggle, buttonClass, cx } from "@/components/ui";
import { isVerbSubject } from "@/data/subjects";
import { loadConfigs, mergeConfig, saveConfig } from "@/lib/config";
import { listChildren, loadLessons, loadSessions, loadSubjects, loadVerbs } from "@/lib/data";
import type { Child, SessionRow, Subject, SubjectConfig } from "@/lib/types";

export default function Overview() {
  const [children, setChildren] = useState<Child[] | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [configs, setConfigs] = useState<Record<string, SubjectConfig>>({});
  const [counts, setCounts] = useState<Record<string, { lessons?: number; exercises?: number; verbs?: number }>>({});
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    listChildren().then(setChildren);
    loadSessions(undefined, undefined, 100).then(setSessions);
    (async () => {
      const [subs, cfgs] = await Promise.all([loadSubjects(), loadConfigs()]);
      setSubjects(subs);
      setConfigs(cfgs);
      const pairs = await Promise.all(
        subs.map(async (s) => {
          // slovesá nemajú lekcie ani cvičenia, len jeden očíslovaný zoznam
          if (isVerbSubject(s.slug)) return [s.slug, { verbs: (await loadVerbs()).length }] as const;
          const ls = await loadLessons(s.slug);
          return [s.slug, { lessons: ls.length, exercises: ls.reduce((n, l) => n + l.exercises, 0) }] as const;
        }),
      );
      setCounts(Object.fromEntries(pairs));
    })();
  }, []);

  async function toggleSubject(slug: string, on: boolean) {
    setBusy(slug);
    const cfg = mergeConfig({ ...(configs[slug] ?? {}), enabled: on });
    setConfigs((c) => ({ ...c, [slug]: cfg }));
    try {
      await saveConfig(slug as Subject["slug"], cfg);
    } finally {
      setBusy(null);
    }
  }

  if (!children) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-black">Prehľad</h1>
        <Link href="/rodic/dieta" className={buttonClass("outline", "sm")}>
          <Plus className="size-4" /> Pridať dieťa
        </Link>
      </div>

      <section>
        <h2 className="text-lg font-black mb-3">Predmety</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {subjects.map((s) => {
            const cfg = configs[s.slug];
            const c = counts[s.slug] ?? {};
            const verbs = isVerbSubject(s.slug);
            const lessons = c.lessons ?? 0;
            return (
              <Card key={s.slug} className={cx("p-4", !cfg?.enabled && "opacity-70")}>
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{s.icon}</span>
                  <div className="min-w-0">
                    <h3 className="font-black text-lg">{s.name}</h3>
                    <p className="text-sm text-slate font-semibold">
                      {verbs
                        ? `${c.verbs ?? 0} ${(c.verbs ?? 0) === 1 ? "sloveso" : (c.verbs ?? 0) < 5 ? "slovesá" : "slovies"} v zozname`
                        : `${lessons} ${lessons === 1 ? "lekcia" : lessons < 5 ? "lekcie" : "lekcií"} · ${c.exercises ?? 0} cvičení`}
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <Toggle
                    checked={!!cfg?.enabled}
                    onChange={(v) => toggleSubject(s.slug, v)}
                    label={cfg?.enabled ? "Zapnutý pre deti" : "Vypnutý"}
                    description={busy === s.slug ? "Ukladám…" : undefined}
                  />
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Link href={`/rodic/${s.slug}`} className={buttonClass("primary", "sm")}>
                    <BookOpen className="size-4" /> {verbs ? "Zoznam slovies" : "Lekcie"}
                  </Link>
                  <Link href={`/rodic/${s.slug}/nastavenia`} className={buttonClass("outline", "sm")}>
                    <Settings className="size-4" /> Nastavenia predmetu
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-black mb-3">Deti</h2>
        {children.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="font-bold">Zatiaľ nemáš žiadne dieťa.</p>
            <Link href="/rodic/dieta" className={buttonClass("primary", "md", "mt-3")}>
              Vytvoriť profil dieťaťa
            </Link>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {children.map((ch) => {
              const mine = sessions.filter((s) => s.child_id === ch.id);
              return (
                <Card key={ch.id} className="p-4 flex items-center gap-3">
                  <span className="text-4xl">{ch.avatar}</span>
                  <div className="min-w-0">
                    <h3 className="font-black">{ch.name}</h3>
                    <p className="text-sm text-slate font-semibold">
                      {ch.grade}. trieda · {mine.length} tréningov{mine[0] ? ` · naposledy ${mine[0].score} %` : ""}
                    </p>
                  </div>
                  <Link href={`/rodic/dieta?id=${ch.id}`} aria-label={`Upraviť ${ch.name}`} className={buttonClass("ghost", "sm", "ml-auto")}>
                    <Pencil className="size-4" />
                  </Link>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <Card className="p-4">
        <h2 className="font-black">Ako to funguje</h2>
        <ol className="mt-2 space-y-1 text-sm text-slate font-semibold list-decimal pl-5">
          <li>V predmete pridaj lekciu a nafoť strany z učebnice.</li>
          <li>Appka text prepíše, ty ho skontroluješ.</li>
          <li>Stlač „Generovať cvičenia“ a vyber počet.</li>
          <li>Cvičenia uprav, doplň alebo zmaž a predmet zapni deťom.</li>
        </ol>
        <Link href="/rodic/nastavenia" className={buttonClass("ghost", "sm", "mt-2")}>
          Účet a PIN
        </Link>
      </Card>
    </div>
  );
}
