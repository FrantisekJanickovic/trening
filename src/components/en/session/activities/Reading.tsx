"use client";

import { Languages, Play, Square } from "lucide-react";
import { useRef, useState } from "react";
import { stopSpeaking } from "@/lib/en/speech";
import type { LessonText } from "@/lib/en/types";
import { Button, cx } from "@/components/ui";
import type { SessionCtx } from "../engine";
import { BottomBar } from "../parts";

export default function Reading({ texts, ctx, onDone }: { texts: LessonText[]; ctx: SessionCtx; onDone: () => void }) {
  const [shown, setShown] = useState<Set<string>>(new Set());
  const [all, setAll] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const stop = useRef(false);

  async function readAll() {
    if (playing) {
      stop.current = true;
      stopSpeaking();
      setPlaying(null);
      return;
    }
    stop.current = false;
    for (const t of texts) {
      for (let i = 0; i < t.sentences.length; i++) {
        if (stop.current) return;
        const k = `${t.id}-${i}`;
        setPlaying(k);
        await ctx.say(t.sentences[i].en, "en");
        await new Promise((r) => setTimeout(r, 300));
      }
    }
    setPlaying(null);
  }

  return (
    <div className="flex flex-col gap-4 flex-1">
      <div className="flex gap-2 justify-center">
        <Button size="sm" variant="outline" onClick={readAll}>
          {playing ? <Square className="size-4" /> : <Play className="size-4" />} {playing ? "Zastaviť" : "Prečítaj mi text"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setAll(!all)}>
          <Languages className="size-4" /> {all ? "Skryť preklad" : "Ukáž preklad"}
        </Button>
      </div>
      <p className="text-center text-sm font-bold text-slate">Ťukni na vetu a uvidíš preklad</p>
      {texts.map((t) => (
        <article key={t.id} className="rounded-[2rem] bg-card border-2 border-line px-5 py-5 space-y-2">
          {t.title && <h2 className="text-xl font-black mb-2">{t.title}</h2>}
          {t.sentences.map((s, i) => {
            const k = `${t.id}-${i}`;
            const open = all || shown.has(k);
            return (
              <button
                key={k}
                type="button"
                onClick={() => {
                  ctx.say(s.en, "en");
                  setShown((x) => {
                    const n = new Set(x);
                    if (n.has(k)) n.delete(k);
                    else n.add(k);
                    return n;
                  });
                }}
                className={cx("block w-full text-left rounded-xl px-2 py-1.5 transition-colors", playing === k ? "bg-sun-soft" : "hover:bg-paper")}
              >
                <span className="text-lg font-semibold leading-snug">{s.en}</span>
                {open && s.sk && <span className="block text-ink-soft">{s.sk}</span>}
              </button>
            );
          })}
        </article>
      ))}
      <BottomBar>
        <Button
          size="xl"
          onClick={() => {
            stop.current = true;
            stopSpeaking();
            onDone();
          }}
        >
          Hotovo
        </Button>
      </BottomBar>
    </div>
  );
}
