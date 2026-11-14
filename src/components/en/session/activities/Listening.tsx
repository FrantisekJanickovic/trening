"use client";

import { Eye, EyeOff, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { stopSpeaking } from "@/lib/en/speech";
import type { Sentence } from "@/lib/en/types";
import { Button, cx } from "@/components/ui";
import type { SessionCtx } from "../engine";
import { BottomBar, Progress } from "../parts";

/** The AI voice reads each English sentence, then its Slovak translation. */
export default function Listening({ sentences, ctx, onDone }: { sentences: Sentence[]; ctx: SessionCtx; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [stage, setStage] = useState<"idle" | "en" | "sk">("idle");
  const [showText, setShowText] = useState(false);
  const [auto, setAuto] = useState(false);
  const run = useRef(0);
  const s = sentences[i];

  async function play(index: number) {
    const id = ++run.current;
    const cur = sentences[index];
    if (!cur) return;
    setStage("en");
    await ctx.say(cur.en, "en");
    if (id !== run.current) return;
    await new Promise((r) => setTimeout(r, 600));
    if (id !== run.current) return;
    setStage("sk");
    if (cur.sk) await ctx.say(cur.sk, "sk");
    if (id !== run.current) return;
    setStage("idle");
  }

  useEffect(() => {
    play(i).then(() => {
      if (auto && i + 1 < sentences.length) setTimeout(() => setI((x) => x + 1), 700);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, auto]);

  useEffect(
    () => () => {
      run.current++;
      stopSpeaking();
    },
    [],
  );

  if (!s) return null;
  const last = i + 1 >= sentences.length;

  return (
    <div className="flex flex-col gap-5 flex-1">
      <Progress value={i + 1} total={sentences.length} />
      <p className="text-center text-sm font-bold text-slate">Počúvaj: najprv anglicky, potom preklad</p>
      <div className="rounded-[2rem] bg-card border-2 border-line border-b-[6px] px-5 py-8 text-center min-h-48 flex flex-col items-center justify-center gap-3">
        <div className="flex gap-2" aria-hidden>
          {["en", "sk"].map((k) => (
            <span key={k} className={cx("px-3 py-1 rounded-full text-sm font-black", stage === k ? "bg-sun text-ink" : "bg-paper text-mist")}>
              {k === "en" ? "EN" : "SK"}
            </span>
          ))}
        </div>
        {showText ? (
          <>
            <div className={cx("text-2xl font-black", stage === "en" && "text-sky")}>{s.en}</div>
            <div className={cx("text-lg text-ink-soft", stage === "sk" && "text-sky")}>{s.sk}</div>
          </>
        ) : (
          <div className="text-slate font-semibold">Text je skrytý, sústreď sa na počúvanie</div>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button size="sm" variant="outline" onClick={() => play(i)}>
          <RotateCcw className="size-4" /> Zopakovať
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowText(!showText)}>
          {showText ? <EyeOff className="size-4" /> : <Eye className="size-4" />} {showText ? "Skryť text" : "Ukázať text"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (auto) {
              run.current++;
              stopSpeaking();
              setStage("idle");
            }
            setAuto(!auto);
          }}
        >
          {auto ? <Pause className="size-4" /> : <Play className="size-4" />} {auto ? "Zastaviť" : "Prehrať všetko"}
        </Button>
      </div>
      <BottomBar>
        <Button
          size="xl"
          onClick={() => {
            if (last) {
              run.current++;
              stopSpeaking();
              onDone();
            } else setI((x) => x + 1);
          }}
        >
          {last ? "Hotovo" : "Ďalšia veta"}
        </Button>
      </BottomBar>
    </div>
  );
}
