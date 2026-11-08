"use client";

import { ArrowLeft, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, Spinner, buttonClass } from "@/components/ui";
import { GRADES, gradeLabel, isVerbSubject, subjectDef, type SubjectSlug } from "@/data/subjects";
import { loadLessons } from "@/lib/data";
import type { LessonWithCounts } from "@/lib/types";
import VerbsAdmin from "./verbs";

export default function SubjectPage() {
  const slug = String(useParams().slug) as SubjectSlug;
  // slovesá nemajú lekcie, ale jeden očíslovaný zoznam — majú vlastnú správu
  if (isVerbSubject(slug)) return <VerbsAdmin slug={slug} />;
  return <SubjectLessons slug={slug} />;
}

function SubjectLessons({ slug }: { slug: SubjectSlug }) {
  const def = subjectDef(slug);
  const [lessons, setLessons] = useState<LessonWithCounts[] | null>(null);

  useEffect(() => {
    loadLessons(slug)
      .then(setLessons)
      .catch(() => setLessons([]));
  }, [slug]);

  if (!def)
    return (
      <div className="space-y-3">
        <p className="font-bold">Taký predmet neexistuje.</p>
        <Link href="/rodic" className="text-sky font-bold">
          Späť na prehľad
        </Link>
      </div>
    );
  if (!lessons) return <Spinner />;

  const grades = [...new Set(lessons.map((l) => l.grade ?? 0))].sort((a, b) => a - b);

  return (
    <div className="space-y-5">
      <Link href="/rodic" className="inline-flex items-center gap-1 text-sm font-bold text-slate">
        <ArrowLeft className="size-4" /> Prehľad
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-4xl">{def.icon}</span>
        <h1 className="text-2xl font-black mr-auto">{def.name}</h1>
        <Link href={`/rodic/${slug}/nastavenia`} className={buttonClass("outline", "sm")}>
          <Settings className="size-4" /> Nastavenia
        </Link>
        <Link href={`/rodic/${slug}/lekcia`} className={buttonClass("primary", "sm")}>
          <Plus className="size-4" /> Nová lekcia
        </Link>
      </div>

      {lessons.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="font-bold">Zatiaľ žiadne lekcie.</p>
          <p className="text-slate text-sm mt-1">Pridaj lekciu, nafoť strany z učebnice a appka z nich vyrobí cvičenia.</p>
          <Link href={`/rodic/${slug}/lekcia`} className={buttonClass("primary", "md", "mt-3")}>
            <Plus className="size-4" /> Nová lekcia
          </Link>
        </Card>
      ) : (
        grades.map((g) => (
          <section key={g} aria-label={g ? gradeLabel(g) : "Bez triedy"} className="space-y-2">
            <h2 className="text-lg font-black">{g ? gradeLabel(g) : "Bez triedy"}</h2>
            {lessons
              .filter((l) => (l.grade ?? 0) === g)
              .map((l) => (
                <Link key={l.id} href={`/rodic/${slug}/lekcia?id=${l.id}`} className="block">
                  <Card className="p-4 flex items-center gap-3 border-2 border-b-[5px] hover:border-sun-deep">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-black truncate">{l.title}</h3>
                      <p className="text-sm text-slate font-semibold">
                        {l.exercises} cvičení · {l.sources} {l.sources === 1 ? "časť materiálu" : "častí materiálu"}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-sky">Upraviť</span>
                  </Card>
                </Link>
              ))}
          </section>
        ))
      )}
      <p className="text-xs text-slate">Triedy: {GRADES.map(gradeLabel).join(", ")}.</p>
    </div>
  );
}
