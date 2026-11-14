"use client";

import { useEffect, useState } from "react";
import { canRecognize } from "@/lib/en/speech";
import { normalize, stripDiacritics } from "@/lib/en/text";
import type { Sentence } from "@/lib/en/types";
import { Button, SpeakButton } from "@/components/ui";
import type { SessionCtx } from "../engine";
import { BottomBar, MicButton, Progress } from "../parts";

function overlap(said: string, target: string) {
  const a = new Set(stripDiacritics(normalize(said)).split(" "));
  const words = stripDiacritics(normalize(target)).split(" ").filter(Boolean);
  if (!words.length) return 0;
  return words.filter((w) => a.has(w)).length / words.length;
}

export default function Shadowing({ sentences, ctx, onDone }: { sentences: Sentence[]; ctx: SessionCtx; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [result, setResult] = useState<{ score: number; said: string } | null>(null);
  const s = sentences[i];

  useEffect(() => {
    if (!s) {
      onDone();
      return;
    }
    setResult(null);
    ctx.say(s.en, "en");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  if (!s) return null;

  function onSpeech(alts: string[]) {
    const best = alts.map((a) => ({ a, sc: overlap(a, s.en) })).sort((x, y) => y.sc - x.sc)[0];
    setResult(best ? { score: best.sc, said: best.a } : { score: 0, said: "" });
  }

  const verdict = !result
    ? null
    : result.score >= 0.8
      ? "Výborne, znelo to presne!"
      : result.score >= 0.5
        ? "Dobre! Skús ešte raz pomalšie."
        : "Skús to ešte raz, počúvaj pozorne.";

  return (
    <div className="flex flex-col gap-5 flex-1">
      <Progress value={i} total={sentences.length} />
      <p className="text-center text-sm font-bold text-slate">Vypočuj si vetu a zopakuj ju nahlas</p>
      <div className="rounded-[2rem] bg-card border-2 border-line border-b-[6px] px-5 py-7 text-center">
        <div className="flex items-center justify-center gap-3">
          <span className="text-2xl font-black">{s.en}</span>
          <SpeakButton onClick={() => ctx.say(s.en, "en")} />
        </div>
        {s.sk && <div className="mt-2 text-ink-soft">{s.sk}</div>}
      </div>
      {canRecognize() ? <MicButton lang="en" onResult={onSpeech} /> : <p className="text-center text-sm text-slate">Povedz vetu nahlas a pokračuj.</p>}
      {result && (
        <div className="text-center anim-rise">
          <div className="text-lg font-black">{verdict}</div>
          {result.said && <div className="text-sm text-slate">Počula som: „{result.said}“</div>}
        </div>
      )}
      <BottomBar>
        <Button size="xl" variant={result && result.score >= 0.8 ? "leaf" : "primary"} onClick={() => setI((x) => x + 1)}>
          {i + 1 < sentences.length ? "Ďalšia veta" : "Hotovo"}
        </Button>
      </BottomBar>
    </div>
  );
}
