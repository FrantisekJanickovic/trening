"use client";

import { CalendarRange, Eye, Network, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { MapDownloads, MindmapOverlay } from "@/components/mindmap-view";
import { PagePicker } from "@/components/pages-picker";
import { Button, ErrorNote, Field, Textarea, cx, useBusyCursor } from "@/components/ui";
import type { SubjectSlug } from "@/data/subjects";
import { generateMindmap, generateTimeline } from "@/lib/ai";
import { loadMindmaps } from "@/lib/data";
import { describePages, pagesOf } from "@/lib/pages";
import { supabase } from "@/lib/supabase";
import type { Lesson, Mindmap, Source } from "@/lib/types";

const when = (iso: string) => new Date(iso).toLocaleString("sk-SK", { dateStyle: "short", timeStyle: "short" });

export default function Mindmaps({ lesson, sources, slug, ai }: { lesson: Lesson; sources: Source[]; slug: SubjectSlug; ai: boolean }) {
  const pages = pagesOf(sources, lesson.id);
  const [picked, setPicked] = useState<number[]>([]);
  const [prompt, setPrompt] = useState("");
  const [maps, setMaps] = useState<Mindmap[] | null>(null);
  const [busy, setBusy] = useState<"mindmap" | "timeline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Mindmap | null>(null);

  useBusyCursor(!!busy);

  const reload = useCallback(() => loadMindmaps([lesson.id]).then(setMaps), [lesson.id]);
  useEffect(() => {
    reload().catch(() => setMaps([]));
  }, [reload]);

  const scope = describePages(picked, pages.length);

  async function generate(kind: "mindmap" | "timeline") {
    setBusy(kind);
    setError(null);
    try {
      const used = picked.length ? sources.filter((s) => picked.includes(s.page)) : sources;
      if (!used.length) throw new Error("Pre vybrané strany nie je žiadny materiál.");
      const input = {
        subject: slug,
        grade: lesson.grade,
        title: lesson.title,
        scope,
        sections: used.map((s) => ({ heading: s.heading ?? "", text: s.text })),
        prompt,
      };
      const { data, title } =
        kind === "mindmap"
          ? await generateMindmap(input).then((r) => ({ data: r.map, title: r.map.center }))
          : await generateTimeline(input).then((r) => ({ data: r.timeline, title: r.timeline.title }));
      const { error } = await supabase().from("tr_mindmaps").insert({ lesson_id: lesson.id, kind, pages: picked, prompt, title, data });
      if (error) throw new Error(error.message);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nepodarilo sa to vygenerovať.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleActive(m: Mindmap) {
    setMaps((cur) => (cur ?? []).map((x) => (x.id === m.id ? { ...x, active: !x.active } : x)));
    const { error } = await supabase().from("tr_mindmaps").update({ active: !m.active }).eq("id", m.id);
    if (error) {
      setError(error.message);
      await reload();
    }
  }

  async function remove(m: Mindmap) {
    if (!window.confirm("Zmazať túto pomôcku?")) return;
    const { error } = await supabase().from("tr_mindmaps").delete().eq("id", m.id);
    if (error) setError(error.message);
    if (open?.id === m.id) setOpen(null);
    await reload();
  }

  const caption = (m: Mindmap) => `${lesson.title} · ${describePages(m.pages, pages.length)}`;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-line p-4 space-y-4">
        <div>
          <h2 className="text-lg font-black">Nová pomôcka na tlač</h2>
          <p className="text-sm text-slate mt-0.5">
            Vyber, z čoho sa má vyrobiť. Generovať môžeš opakovane — zakaždým vznikne nová verzia a staré ostanú.
          </p>
        </div>

        {pages.length > 1 ? (
          <PagePicker pages={pages} value={picked} onChange={setPicked} idPrefix="map" />
        ) : (
          <p className="text-sm font-bold text-slate">Lekcia má jednu stranu, mapa bude z celej.</p>
        )}

        <Field label="Pokyn pre AI" hint="Nepovinné, platí pre mapu aj os. Napríklad: zameraj sa na letopočty, alebo vynechaj hospodárstvo.">
          <Textarea rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={600} placeholder="napr. dôraz na príčiny a následky" />
        </Field>

        {error && <ErrorNote>{error}</ErrorNote>}

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={() => generate("mindmap")} loading={busy === "mindmap"} disabled={!ai || !!busy || !sources.length}>
            <Sparkles className="size-4" /> Myšlienková mapa
          </Button>
          <Button variant="outline" onClick={() => generate("timeline")} loading={busy === "timeline"} disabled={!ai || !!busy || !sources.length}>
            <CalendarRange className="size-4" /> Časová os
          </Button>
          <span className="text-xs text-slate font-semibold">{sources.length ? scope : "Najprv nahraj materiál."}</span>
        </div>
        <p className="text-xs text-slate font-semibold">Časová os sa dá vyrobiť len z lekcie, v ktorej sú aspoň štyri udalosti s letopočtom.</p>
        {busy && <p className="text-sm text-slate font-semibold">AI to skladá, chvíľu to potrvá…</p>}
        {!ai && (
          <p className="text-sm text-slate rounded-xl bg-paper px-3 py-2">
            Generovanie sa zapne po nastavení kľúča <code className="font-mono text-xs">OPENAI_API_KEY</code> vo Verceli.
          </p>
        )}
      </div>

      <div>
        <h2 className="text-lg font-black mb-2">Pomôcky ({maps?.length ?? 0})</h2>
        {!maps ? (
          <p className="text-slate">Načítavam…</p>
        ) : maps.length === 0 ? (
          <p className="rounded-2xl bg-paper px-4 py-6 text-center text-slate">Zatiaľ nič. Vyber strany a stlač „Myšlienková mapa“ alebo „Časová os“.</p>
        ) : (
          <ul className="space-y-2" aria-label="Zoznam myšlienkových máp">
            {maps.map((m, i) => (
              <li key={m.id} className={cx("rounded-2xl border p-3", m.active ? "border-leaf bg-leaf-soft/40" : "border-line")}>
                <div className="flex flex-wrap items-start gap-2">
                  {m.kind === "timeline" ? (
                    <CalendarRange className={cx("size-5 mt-0.5 shrink-0", m.active ? "text-leaf" : "text-mist")} />
                  ) : (
                    <Network className={cx("size-5 mt-0.5 shrink-0", m.active ? "text-leaf" : "text-mist")} />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-black truncate">{m.title}</p>
                    <p className="text-sm text-slate font-semibold">
                      {m.kind === "timeline" ? "Časová os" : "Myšlienková mapa"} · verzia {maps.length - i} · {describePages(m.pages, pages.length)} ·{" "}
                      {when(m.created_at)}
                    </p>
                    {m.prompt && <p className="text-xs text-slate mt-0.5 break-words">Pokyn: {m.prompt}</p>}
                  </div>
                  <label className="inline-flex items-center gap-1.5 text-sm font-bold cursor-pointer shrink-0">
                    <input type="checkbox" checked={m.active} onChange={() => toggleActive(m)} className="size-4 accent-[#1f9d63]" />
                    Aktívna
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Button variant="outline" size="sm" aria-label={`Zobraziť pomôcku, verzia ${maps.length - i}`} onClick={() => setOpen(m)}>
                    <Eye className="size-4" /> Zobraziť
                  </Button>
                  <MapDownloads data={m.data} caption={caption(m)} name={`${lesson.title}-${m.title}`} />
                  <Button variant="danger" size="sm" aria-label={`Zmazať pomôcku, verzia ${maps.length - i}`} onClick={() => remove(m)}>
                    <Trash2 className="size-4" /> Zmazať
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {maps && maps.some((m) => m.active) && (
          <p className="text-sm text-slate font-semibold mt-2">Aktívne pomôcky vidí dieťa pri výbere lekcií a môže si ich stiahnuť.</p>
        )}
      </div>

      {open && <MindmapOverlay data={open.data} caption={caption(open)} name={`${lesson.title}-${open.title}`} onClose={() => setOpen(null)} />}
    </div>
  );
}
