"use client";

import { Eye, Keyboard, Mic, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { checkAnswer, displayAnswer } from "@/lib/en/text";
import type { ActivityKey, HintMode } from "@/lib/en/types";
import { Button } from "@/components/ui";
import { sourceOf, targetOf, type DrillItem, type SessionCtx } from "../engine";
import { BottomBar, MicButton, Progress, PromptCard, SentenceBox, Tiles, useRequeue } from "../parts";

type Phase = "ask" | "retry" | "correct" | "wrong";

export default function Classic({
  items,
  ctx,
  onDone,
  activity = "classic",
  hintMode,
  mode = "translate",
}: {
  items: DrillItem[];
  ctx: SessionCtx;
  onDone: () => void;
  activity?: ActivityKey;
  hintMode: HintMode;
  /** translate = show word, answer translation; dictation = hear English, write it */
  mode?: "translate" | "dictation";
}) {
  const q = useRequeue(items);
  const [given, setGiven] = useState("");
  const [phase, setPhase] = useState<Phase>("ask");
  const [revealed, setRevealed] = useState(0);
  const [hintUsed, setHintUsed] = useState(false);
  const [oral, setOral] = useState(ctx.oral && mode === "translate");
  const [note, setNote] = useState<string | null>(null);
  const started = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const item = q.current;

  useEffect(() => {
    if (q.done) onDone();
  }, [q.done, onDone]);

  useEffect(() => {
    if (!item) return;
    started.current = Date.now();
    if (mode === "dictation") ctx.say(item.en, "en");
    if (!oral) setTimeout(() => inputRef.current?.focus(), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.key]);

  if (!item) return null;

  const src = mode === "dictation" ? { text: item.en, lang: "en" as const } : sourceOf(item);
  const tgt = mode === "dictation" ? { text: item.en, lang: "en" as const } : targetOf(item);
  const answer = displayAnswer(tgt.text);
  const showSlots = hintMode !== "audio" || mode === "dictation";

  function evaluate(candidates: string[]) {
    if (phase === "correct" || phase === "wrong") return;
    const responseMs = Date.now() - started.current;
    const results = candidates.map((c) => ({ c, r: checkAnswer(c, tgt.text, { target: tgt.lang, oral }) }));
    const hit = results.find((x) => x.r.ok);
    const best = hit ?? results[0];
    if (best) setGiven(best.c);
    if (hit) {
      const hinted = hintUsed || phase === "retry";
      setPhase("correct");
      ctx.record({ activity, itemType: "vocab", itemId: item.id, correct: true, hinted, given: hit.c, direction: item.dir, responseMs });
      // after a correct answer: say the word in English and the example sentence
      if (item.example_en) ctx.say(item.example_en, "en");
      else ctx.say(item.en, "en");
      return;
    }
    if (phase === "ask") {
      setPhase("retry");
      setNote(best?.r.close ? "Skoro! Pozri sa na písmenká." : "Skús ešte raz.");
      if (!oral) setTimeout(() => inputRef.current?.select(), 30);
      return;
    }
    setPhase("wrong");
    ctx.record({ activity, itemType: "vocab", itemId: item.id, correct: false, given: best?.c, direction: item.dir, responseMs });
    q.requeue(item);
    ctx.say(item.en, "en");
  }

  function next() {
    setGiven("");
    setPhase("ask");
    setRevealed(0);
    setHintUsed(false);
    setNote(null);
    q.next();
  }

  function hint() {
    setHintUsed(true);
    if (hintMode === "reveal") setRevealed((r) => Math.min(r + 1, answer.replace(/\s/g, "").length));
    else ctx.say(answer, tgt.lang);
  }

  const finished = phase === "correct" || phase === "wrong";

  return (
    <div className="flex flex-col gap-5 flex-1">
      <Progress value={q.index} total={q.queue.length} />

      {mode === "dictation" ? (
        <div className="rounded-[2rem] bg-card border-2 border-line border-b-[6px] px-5 py-8 text-center anim-rise">
          <p className="font-bold text-slate mb-4">Vypočuj si a napíš po anglicky</p>
          <div className="flex justify-center gap-3">
            <Button size="lg" variant="outline" onClick={() => ctx.say(item.en, "en")}>
              <Volume2 className="size-6" /> Prehrať
            </Button>
            <Button size="lg" variant="ghost" onClick={() => ctx.say(item.en, "en")}>
              Ešte raz
            </Button>
          </div>
          {finished && <p className="mt-4 text-lg font-bold text-ink-soft">{item.sk}</p>}
        </div>
      ) : (
        <PromptCard key={item.key} text={src.text} lang={src.lang} emoji={item.emoji} ctx={ctx} autoSpeak={src.lang === "en"} />
      )}

      <div className="text-center text-sm font-bold text-slate">
        {mode === "dictation" ? "" : `Prelož do ${tgt.lang === "en" ? "angličtiny" : "slovenčiny"}`}
      </div>

      <Tiles
        answer={answer}
        typed={phase === "wrong" ? answer : given}
        revealed={revealed}
        showSlots={showSlots}
        state={phase === "correct" ? "ok" : phase === "wrong" ? "solution" : phase === "retry" && note && given ? "bad" : "idle"}
      />

      {note && phase === "retry" && <p className="text-center font-bold text-sun-deep">{note}</p>}
      {phase === "wrong" && (
        <p className="text-center font-bold text-tomato">
          Správne je <span className="text-ink">{tgt.text}</span>
          {given && <span className="text-slate font-semibold"> (tvoja odpoveď: „{given}“)</span>}
        </p>
      )}

      {finished && <SentenceBox en={item.example_en} sk={item.example_sk} ctx={ctx} />}

      {!finished && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (given.trim()) evaluate([given]);
          }}
          className="flex flex-col gap-3"
        >
          {oral ? (
            <MicButton lang={tgt.lang} onResult={(alts) => (alts.length ? evaluate(alts) : setNote("Nepočula som ťa, skús znova."))} />
          ) : (
            <input
              ref={inputRef}
              value={given}
              onChange={(e) => {
                setGiven(e.target.value);
                if (phase === "retry") setNote(null);
              }}
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="done"
              aria-label="Tvoja odpoveď"
              placeholder="Napíš odpoveď"
              className="w-full h-14 rounded-2xl border-2 border-line bg-card px-4 text-xl font-bold text-center focus:border-sky outline-none"
            />
          )}
          <div className="flex justify-center gap-2">
            {(hintMode === "reveal" || hintMode === "audio") && mode === "translate" && (
              <Button type="button" size="sm" variant="ghost" onClick={hint}>
                {hintMode === "reveal" ? <Eye className="size-4" /> : <Volume2 className="size-4" />}
                {hintMode === "reveal" ? "Odkry písmenko" : "Nápoveda"}
              </Button>
            )}
            {ctx.oral && mode === "translate" && (
              <Button type="button" size="sm" variant="ghost" onClick={() => setOral(!oral)}>
                {oral ? <Keyboard className="size-4" /> : <Mic className="size-4" />}
                {oral ? "Napísať" : "Povedať"}
              </Button>
            )}
          </div>
          {!oral && (
            <BottomBar>
              <Button type="submit" size="xl" disabled={!given.trim()}>
                Skontrolovať
              </Button>
            </BottomBar>
          )}
        </form>
      )}

      {finished && (
        <BottomBar>
          <Button size="xl" variant={phase === "correct" ? "leaf" : "primary"} onClick={next} autoFocus>
            Ďalej
          </Button>
        </BottomBar>
      )}
    </div>
  );
}
