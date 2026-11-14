"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, Spinner } from "@/components/ui";
import { isEnglishSubject, isVerbSubject } from "@/data/subjects";
import { loadConfigs } from "@/lib/config";
import { getChild, loadLessons, loadSubjects, loadVerbs } from "@/lib/data";
import { countLessons as countEnglishLessons } from "@/lib/en/data";
import { getLockedChild } from "@/lib/device";
import type { Child, Subject, SubjectConfig } from "@/lib/types";

/** Pri slovesách sa počítajú slovesá, pri ostatných predmetoch lekcie. */
const countLabel = (slug: string, n: number) =>
  isVerbSubject(slug) ? `${n} ${n === 1 ? "sloveso" : n < 5 ? "slovesá" : "slovies"}` : `${n} ${n === 1 ? "lekcia" : n < 5 ? "lekcie" : "lekcií"}`;

export default function SubjectPicker() {
  const childId = useSearchParams().get("child") ?? "";
  const [child, setChild] = useState<Child | null | undefined>(undefined);
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [configs, setConfigs] = useState<Record<string, SubjectConfig>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const locked = getLockedChild() === childId;

  useEffect(() => {
    getChild(childId).then(setChild);
    (async () => {
      const [subs, cfgs] = await Promise.all([loadSubjects(), loadConfigs()]);
      setSubjects(subs);
      setConfigs(cfgs);
      const on = subs.filter((s) => cfgs[s.slug]?.enabled);
      const pairs = await Promise.all(
        on.map(async (s) =>
          isVerbSubject(s.slug)
            ? ([s.slug, (await loadVerbs()).filter((v) => v.enabled).length] as const)
            : isEnglishSubject(s.slug)
              ? ([s.slug, await countEnglishLessons()] as const)
              : ([s.slug, (await loadLessons(s.slug)).filter((l) => l.exercises > 0).length] as const),
        ),
      );
      setCounts(Object.fromEntries(pairs));
    })().catch(() => setSubjects([]));
  }, [childId]);

  if (child === undefined || !subjects) return <Spinner />;
  if (!child)
    return (
      <main className="p-6 text-center">
        <p className="font-bold">Profil sa nenašiel.</p>
        <Link href="/" className="text-sky font-bold">
          Späť
        </Link>
      </main>
    );

  const active = subjects.filter((s) => configs[s.slug]?.enabled);

  return (
    <main className="flex-1 w-full max-w-xl mx-auto px-4 pt-4 pb-10">
      <header className="flex items-center gap-2">
        {!locked && (
          <Link href="/" aria-label="Späť na výber profilu" className="size-10 -ml-2 inline-flex items-center justify-center rounded-xl hover:bg-ink/5">
            <ArrowLeft className="size-5" />
          </Link>
        )}
        <span className="text-3xl">{child.avatar}</span>
        <span className="font-black text-xl">{child.name}</span>
      </header>

      <h1 className="text-2xl font-black mt-6">Čo budeme trénovať?</h1>

      {active.length === 0 ? (
        <Card className="p-6 mt-4 text-center text-slate">Zatiaľ nie je zapnutý žiadny predmet. Rodič ho zapne v rodičovskej zóne.</Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 mt-4">
          {active.map((s) => (
            <Link
              key={s.slug}
              href={`/predmet/${s.slug}?child=${childId}`}
              className="rounded-3xl bg-card border-2 border-line border-b-[6px] p-5 flex flex-col items-center gap-2 hover:border-sun-deep active:translate-y-[2px] active:border-b-4 transition"
            >
              <span className="text-5xl leading-none">{s.icon}</span>
              <span className="text-xl font-black">{s.name}</span>
              <span className="text-sm text-slate font-semibold">{countLabel(s.slug, counts[s.slug] ?? 0)}</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
