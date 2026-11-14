"use client";

import { RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cx, SpeakButton } from "@/components/ui";
import { Button } from "@/components/ui";
import { sourceOf, targetOf, type DrillItem, type SessionCtx } from "../engine";
import { BottomBar, Progress, useRequeue } from "../parts";

export default function Flashcards({ items, ctx, onDone }: { items: DrillItem[]; ctx: SessionCtx; onDone: () => void }) {
  const q = useRequeue(items);
  const [flipped, setFlipped] = useState(false);
  const started = useRef(0);
  const item = q.current;

  useEffect(() => {
    if (q.done) onDone();
  }, [q.done, onDone]);

  useEffect(() => {
    if (!item) return;
    started.current = Date.now();
    setFlipped(false);
    const s = sourceOf(item);
    if (s.lang === "en") ctx.say(s.text, "en");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.key]);

  if (!item) return null;
  const src = sourceOf(item);
  const tgt = targetOf(item);

  function flip() {
    if (flipped) return;
    setFlipped(true);
    if (tgt.lang === "en") ctx.say(tgt.text, "en");
    else if (item.example_en) ctx.say(item.example_en, "en");
  }

  function grade(g: "no" | "almost" | "yes") {
    ctx.record({
      activity: "flashcards",
      itemType: "vocab",
      itemId: item.id,
      correct: g !== "no",
      hinted: g === "almost",
      direction: item.dir,
      responseMs: Date.now() - started.current,
    });
    if (g === "no") q.requeue(item);
    q.next();
  }

  const face = "flip-face rounded-[2rem] border-2 border-b-[6px] px-5 py-8 min-h-[18rem] flex flex-col items-center justify-center text-center";

  return (
    <div className="flex flex-col gap-5 flex-1">
      <Progress value={q.index} total={q.queue.length} />
      <p className="text-center text-sm font-bold text-slate">{flipped ? "Ako ti to išlo? Odpovedz úprimne." : "Spomeň si na preklad a potom otoč kartičku"}</p>

      <div
        className="flip-card"
        onClick={flip}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && flip()}
        aria-label="Otočiť kartičku"
      >
        <div className={cx("flip-inner", flipped && "flipped")}>
          <div className={cx(face, "bg-card border-line")}>
            {ctx.showEmoji && item.emoji && <div className="text-6xl mb-3 leading-none">{item.emoji}</div>}
            <div className="text-4xl font-black break-words">{src.text}</div>
            <div className="mt-2 text-sm font-bold text-mist">{src.lang === "en" ? "anglicky" : "slovensky"}</div>
            {!flipped && (
              <div className="mt-6 inline-flex items-center gap-1.5 text-sky font-bold">
                <RotateCcw className="size-4" /> Ťukni a otoč
              </div>
            )}
          </div>
          <div className={cx(face, "flip-back bg-sun-soft border-sun-deep")}>
            {ctx.showEmoji && item.emoji && <div className="text-5xl mb-2 leading-none">{item.emoji}</div>}
            <div className="flex items-center gap-3">
              <span className="text-4xl font-black break-words">{tgt.text}</span>
              <span onClick={(e) => e.stopPropagation()}>
                <SpeakButton onClick={() => ctx.say(item.en, "en")} />
              </span>
            </div>
            <div className="mt-1 text-sm font-bold text-sun-deep">{tgt.lang === "en" ? "anglicky" : "slovensky"}</div>
            {item.example_en && (
              <div className="mt-5 text-ink">
                <div className="font-bold">{item.example_en}</div>
                {item.example_sk && <div className="text-ink-soft">{item.example_sk}</div>}
              </div>
            )}
          </div>
        </div>
      </div>

      <BottomBar>
        {flipped ? (
          <>
            <Button size="xl" variant="danger" className="!w-auto flex-1" onClick={() => grade("no")}>
              Neviem
            </Button>
            <Button size="xl" variant="sun" className="!w-auto flex-1" onClick={() => grade("almost")}>
              Takmer
            </Button>
            <Button size="xl" variant="leaf" className="!w-auto flex-1" onClick={() => grade("yes")}>
              Viem
            </Button>
          </>
        ) : (
          <Button size="xl" onClick={flip}>
            Otočiť
          </Button>
        )}
      </BottomBar>
    </div>
  );
}
