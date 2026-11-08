"use client";

import { ArrowLeft, ImageOff } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, Spinner, buttonClass } from "@/components/ui";
import { subjectDef, type SubjectSlug } from "@/data/subjects";
import { loadFigures, loadLessons } from "@/lib/data";
import { figureUrls } from "@/lib/figures";
import type { Figure, LessonWithCounts } from "@/lib/types";

/**
 * Galéria pre dieťa: len pozeranie, žiadne otázky.
 * Popis z knihy aj dovysvetlenie sú pod obrázkom, aby si vedelo prečítať,
 * čo na ňom vlastne je.
 */
export default function GalleryView() {
  const slug = String(useParams().slug) as SubjectSlug;
  const childId = useSearchParams().get("child") ?? "";
  const def = subjectDef(slug);

  const [lessons, setLessons] = useState<LessonWithCounts[] | null>(null);
  const [figures, setFigures] = useState<Figure[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const ls = await loadLessons(slug);
      setLessons(ls);
      const f = await loadFigures(ls.map((l) => l.id));
      setFigures(f);
      setUrls(await figureUrls(f).catch(() => ({})));
    })().catch(() => setLessons([]));
  }, [slug]);

  if (!lessons) return <Spinner />;

  const byLesson = lessons.map((l) => ({ lesson: l, items: figures.filter((f) => f.lesson_id === l.id) })).filter((g) => g.items.length);

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-5 safe-bottom">
      <Link href={`/predmet/${slug}?child=${childId}`} className="inline-flex items-center gap-1 text-sm font-bold text-slate">
        <ArrowLeft className="size-4" /> Späť na {def?.name ?? slug}
      </Link>

      <h1 className="text-2xl font-black mt-3">Obrázky z učebnice</h1>
      <p className="text-slate font-semibold mt-1">Môžeš si ich len tak pozerať. Nič sa tu neskúša.</p>

      {byLesson.length === 0 ? (
        <Card className="p-8 text-center mt-6">
          <ImageOff className="size-7 mx-auto mb-2 text-mist" />
          <p className="font-bold">Zatiaľ tu nie sú žiadne obrázky.</p>
          <Link href={`/predmet/${slug}?child=${childId}`} className={buttonClass("outline", "md", "mt-4")}>
            Späť na lekcie
          </Link>
        </Card>
      ) : (
        byLesson.map(({ lesson, items }) => (
          <section key={lesson.id} className="mt-7">
            <h2 className="text-lg font-black mb-3">{lesson.title}</h2>
            <div className="space-y-4">
              {items.map((f) => (
                <Card key={f.id} className="overflow-hidden">
                  {urls[f.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- podpísaná adresa z úložiska, optimalizácia Next sa na ňu nedá použiť
                    <img src={urls[f.id]} alt={f.caption || "Obrázok z učebnice"} className="w-full bg-white object-contain max-h-96" />
                  ) : (
                    <div className="w-full aspect-4/3 bg-paper" />
                  )}
                  <div className="p-4">
                    {f.caption && <p className="font-black leading-snug">{f.caption}</p>}
                    {f.explain && <p className="text-base text-slate font-semibold leading-relaxed mt-1.5">{f.explain}</p>}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ))
      )}
    </main>
  );
}
