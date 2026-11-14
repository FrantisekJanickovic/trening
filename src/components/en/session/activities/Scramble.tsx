"use client";

import { Delete } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { displayAnswer, normalize, nowMs, shuffle } from "@/lib/en/text";
import { Button, cx } from "@/components/ui";
import type { DrillItem, SessionCtx } from "../engine";
import { BottomBar, Progress, PromptCard, SentenceBox, useRequeue } from "../parts";

type Letter = { ch: string; id: number };

export default function Scramble({ items, ctx, onDone }: { items: DrillItem[]; ctx: SessionCtx; onDone: () => void }) {
  const usable = items.filter((i) => {
    const w = displayAnswer(i.en);
    return w.length <= 16 && /^[a-z' -]+$/i.test(w);
  });
  const q = useRequeue(usable);
  const [pool, setPool] = useState<Letter[]>([]);
  const [built, setBuilt] = useState<Letter[]>([]);
  const [phase, setPhase] = useState<"build" | "retry" | "ok" | "wrong">("build");
  const [shake, setShake] = useState(false);
  const started = useRef(0);
  const item = q.current;
  const word = item ? displayAnswer(item.en) : "";
  const letters = Array.from(word).filter((c) => c !== " ");

  useEffect(() => {
    if (q.done) onDone();
  }, [q.done, onDone]);

  useEffect(() => {
    if (!item) return;
    started.current = nowMs();
    let mixed = shuffle(letters.map((ch, id) => ({ ch: ch.toLowerCase(), id })));
    if (mixed.map((l) => l.ch).join("") === letters.join("").toLowerCase() && letters.length > 1) mixed = [...mixed.slice(1), mixed[0]];
    setPool(mixed);
    setBuilt([]);
    setPhase("build");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.key]);

  useEffect(() => {
    if (!item || phase === "ok" || phase === "wrong") return;
    if (built.length !== letters.length || letters.length === 0) return;
    const attempt = built.map((l) => l.ch).join("");
    const ok = normalize(attempt) === normalize(letters.join(""));
    if (ok) {
      setPhase("ok");
      ctx.record({
        activity: "scramble",
        itemType: "vocab",
        itemId: item.id,
        correct: true,
        hinted: phase === "retry",
        given: attempt,
        responseMs: Date.now() - started.current,
      });
      ctx.say(item.example_en || item.en, "en");
    } else if (phase === "build") {
      setShake(true);
      setTimeout(() => {
        setShake(false);
        setPool((p) => shuffle([...p, ...built]));
        setBuilt([]);
        setPhase("retry");
      }, 500);
    } else {
      setPhase("wrong");
      ctx.record({ activity: "scramble", itemType: "vocab", itemId: item.id, correct: false, given: attempt });
      q.requeue(item);
      ctx.say(item.en, "en");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [built]);

  if (!item) return null;

  // render built letters with the word's spaces
  const slots: (Letter | null | " ")[] = [];
  let bi = 0;
  for (const c of Array.from(word)) {
    if (c === " ") slots.push(" ");
    else slots.push(built[bi++] ?? null);
  }

  const finished = phase === "ok" || phase === "wrong";

  return (
    <div className="flex flex-col gap-5 flex-1">
      <Progress value={q.index} total={q.queue.length} />
      <PromptCard key={item.key} text={item.sk} lang="sk" emoji={item.emoji} ctx={ctx} />
      <p className="text-center text-sm font-bold text-slate">{phase === "retry" ? "Skoro! Skús to poskladať znova." : "Poskladaj anglické slovo"}</p>

      <div className={cx("flex flex-wrap justify-center gap-1.5 min-h-[2.8rem]", shake && "anim-shake")}>
        {phase === "wrong"
          ? Array.from(word).map((c, i) =>
              c === " " ? (
                <span key={i} className="w-3" />
              ) : (
                <span key={i} className="tile tile-ok">
                  {c}
                </span>
              ),
            )
          : slots.map((s, i) =>
              s === " " ? (
                <span key={i} className="w-3" />
              ) : s ? (
                <button
                  key={i}
                  type="button"
                  className={cx("tile", phase === "ok" ? "tile-ok" : shake ? "tile-bad" : "tile-filled")}
                  onClick={() => {
                    if (finished) return;
                    setBuilt((b) => b.filter((x) => x.id !== s.id));
                    setPool((p) => [...p, s]);
                  }}
                >
                  {s.ch}
                </button>
              ) : (
                <span key={i} className="tile" />
              ),
            )}
      </div>

      {!finished && (
        <div className="flex flex-wrap justify-center gap-2">
          {pool.map((l) => (
            <button
              key={l.id}
              type="button"
              className="tile tile-filled !h-14 !min-w-12 !text-2xl active:translate-y-[2px]"
              onClick={() => {
                setPool((p) => p.filter((x) => x.id !== l.id));
                setBuilt((b) => [...b, l]);
              }}
            >
              {l.ch}
            </button>
          ))}
          {built.length > 0 && (
            <button
              type="button"
              aria-label="Vrátiť posledné písmeno"
              className="tile !h-14 !min-w-12 text-slate"
              onClick={() => {
                const last = built[built.length - 1];
                setBuilt((b) => b.slice(0, -1));
                setPool((p) => [...p, last]);
              }}
            >
              <Delete className="size-5" />
            </button>
          )}
        </div>
      )}

      {finished && <SentenceBox en={item.example_en} sk={item.example_sk} ctx={ctx} />}
      {finished && (
        <BottomBar>
          <Button size="xl" variant={phase === "ok" ? "leaf" : "primary"} onClick={q.next} autoFocus>
            Ďalej
          </Button>
        </BottomBar>
      )}
    </div>
  );
}
