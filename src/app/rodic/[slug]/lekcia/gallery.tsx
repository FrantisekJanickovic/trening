"use client";

import { ImageOff, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Card, ErrorNote, Field, Textarea } from "@/components/ui";
import { loadFigures } from "@/lib/data";
import { deleteFigure, figureUrls } from "@/lib/figures";
import { supabase } from "@/lib/supabase";
import type { Figure, Lesson } from "@/lib/types";

/**
 * Obrázky, ktoré appka vyrezala z nafotených strán.
 * Rodič môže popis z knihy aj dovysvetlenie prepísať — AI ich iba navrhne.
 */
export default function Gallery({ lesson }: { lesson: Lesson }) {
  const [figures, setFigures] = useState<Figure[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const f = await loadFigures([lesson.id]);
    setFigures(f);
    setUrls(await figureUrls(f).catch(() => ({})));
  }, [lesson.id]);

  useEffect(() => {
    reload().catch((e) => {
      setFigures([]);
      setError(e instanceof Error ? e.message : "Galériu sa nepodarilo načítať.");
    });
  }, [reload]);

  async function patch(f: Figure, field: "caption" | "explain", value: string) {
    setFigures((cur) => (cur ?? []).map((x) => (x.id === f.id ? { ...x, [field]: value } : x)));
    const { error } = await supabase().from("tr_figures").update({ [field]: value }).eq("id", f.id);
    if (error) setError(error.message);
  }

  async function remove(f: Figure) {
    if (!window.confirm("Zmazať tento obrázok z galérie?")) return;
    try {
      await deleteFigure(f);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Obrázok sa nepodarilo zmazať.");
    }
  }

  if (!figures) return <p className="text-slate">Načítavam…</p>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-black">Galéria ({figures.length})</h2>
        <p className="text-sm text-slate mt-0.5">
          Obrázky, mapy a schémy, ktoré appka našla na nafotených stranách. Dieťa si ich môže prezerať aj mimo tréningu.
        </p>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}

      {figures.length === 0 ? (
        <div className="rounded-2xl bg-paper px-4 py-8 text-center text-slate">
          <ImageOff className="size-6 mx-auto mb-2 text-mist" />
          <p className="font-bold">V tejto lekcii zatiaľ nie sú žiadne obrázky.</p>
          <p className="text-sm mt-1">Appka ich vyreže sama pri nahrávaní strán — ak na stranách nejaké boli.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {figures.map((f) => (
            <li key={f.id}>
              <Card className="p-3 space-y-3">
                <div className="flex items-start gap-3">
                  {urls[f.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- podpísaná adresa z úložiska, optimalizácia Next sa na ňu nedá použiť
                    <img src={urls[f.id]} alt={f.caption || "Obrázok z učebnice"} className="w-40 sm:w-56 rounded-xl border border-line bg-white object-contain" />
                  ) : (
                    <div className="w-40 sm:w-56 aspect-4/3 rounded-xl bg-paper" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-black rounded-md bg-sky-soft text-sky px-1.5 py-0.5">strana {f.page}</span>
                  </div>
                  <button
                    type="button"
                    aria-label="Zmazať obrázok"
                    onClick={() => remove(f)}
                    className="shrink-0 size-8 inline-flex items-center justify-center rounded-lg text-mist hover:text-tomato hover:bg-tomato-soft"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <Field label="Popis z knihy">
                  <Textarea rows={2} defaultValue={f.caption} aria-label="Popis z knihy" onBlur={(e) => patch(f, "caption", e.target.value)} />
                </Field>
                <Field label="Dovysvetlenie pre dieťa" hint="Appka ho napísala jednoduchšie, ako je text v učebnici. Môžeš ho prepísať.">
                  <Textarea rows={3} defaultValue={f.explain} aria-label="Dovysvetlenie pre dieťa" onBlur={(e) => patch(f, "explain", e.target.value)} />
                </Field>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
