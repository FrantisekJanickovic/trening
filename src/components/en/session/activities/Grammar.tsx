"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { checkAnswer, shuffle } from "@/lib/en/text";
import type { GrammarItem } from "@/lib/en/types";
import { Button, cx } from "@/components/ui";
import type { SessionCtx } from "../engine";
import { BottomBar, Progress, useRequeue } from "../parts";

type GItem = GrammarItem & { key: string };

const firstAnswer = (a: string) => a.split("|")[0].trim();
const filled = (prompt: string, answer: string) => prompt.replace(/_{2,}/, firstAnswer(answer));

export default function Grammar({ items, ctx, onDone }: { items: GrammarItem[]; ctx: SessionCtx; onDone: () => void }) {
  const q = useRequeue<GItem>(items.map((g, i) => ({ ...g, key: `${g.id}-${i}` })));
  const [phase, setPhase] = useState<"ask" | "retry" | "ok" | "wrong">("ask");
  const [given, setGiven] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const started = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const item = q.current;
  const choice = ctx.settings.grammarMode === "choice" && (item?.options?.length ?? 0) >= 2;
  const options = useMemo(() => (item ? shuffle(item.options) : []), [item]);

  useEffect(() => {
    if (q.done) onDone();
  }, [q.done, onDone]);

  useEffect(() => {
    if (!item) return;
    started.current = Date.now();
    setPhase("ask");
    setGiven("");
    setPicked(null);
    if (!choice) setTimeout(() => inputRef.current?.focus(), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.key]);

  if (!item) return null;

  function evaluate(value: string) {
    if (!item || phase === "ok" || phase === "wrong") return;
    const alts = item.answer.split("|").join(",");
    const ok = checkAnswer(value, alts, { target: "en" }).ok;
    if (ok) {
      setPhase("ok");
      ctx.record({
        activity: "grammar",
        itemType: "grammar",
        itemId: item.id,
        correct: true,
        hinted: phase === "retry",
        given: value,
        responseMs: Date.now() - started.current,
      });
      ctx.say(filled(item.prompt, item.answer), "en");
    } else if (phase === "ask" && !choice) {
      setPhase("retry");
    } else {
      setPhase("wrong");
      ctx.record({ activity: "grammar", itemType: "grammar", itemId: item.id, correct: false, given: value });
      q.requeue(item);
      ctx.say(filled(item.prompt, item.answer), "en");
    }
  }

  const [before, after] = item.prompt.split(/_{2,}/);
  const finished = phase === "ok" || phase === "wrong";
  const gapText = finished ? firstAnswer(item.answer) : choice ? (picked ?? "") : given;

  return (
    <div className="flex flex-col gap-5 flex-1">
      <Progress value={q.index} total={q.queue.length} />
      <p className="text-center text-sm font-bold text-slate">Doplň do vety</p>
      <div
        className={cx(
          "rounded-[2rem] bg-card border-2 border-line border-b-[6px] px-5 py-7 text-center text-2xl font-bold leading-relaxed",
          phase === "retry" && "anim-shake",
        )}
      >
        {before}
        <span
          className={cx(
            "inline-block min-w-20 mx-1 px-2 rounded-lg border-b-4",
            phase === "ok"
              ? "bg-leaf-soft border-leaf text-leaf"
              : phase === "wrong"
                ? "bg-leaf-soft border-leaf text-leaf"
                : phase === "retry"
                  ? "bg-tomato-soft border-tomato"
                  : "bg-sun-soft border-sun-deep",
          )}
        >
          {gapText || " "}
        </span>
        {after ?? ""}
        {item.translation_sk && <div className="mt-3 text-base font-semibold text-slate">{item.translation_sk}</div>}
      </div>

      {phase === "retry" && <p className="text-center font-bold text-sun-deep">Ešte raz, skús inú odpoveď.</p>}
      {finished && item.explanation_sk && <div className="rounded-2xl bg-sky-soft px-4 py-3 text-ink anim-rise">{item.explanation_sk}</div>}
      {phase === "wrong" && picked !== null && choice && <p className="text-center font-bold text-tomato">Správne je „{firstAnswer(item.answer)}“</p>}

      {!finished &&
        (choice ? (
          <div className="grid grid-cols-2 gap-3">
            {options.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => {
                  setPicked(o);
                  evaluate(o);
                }}
                className="min-h-14 rounded-2xl border-2 border-b-4 bg-card border-line px-3 text-lg font-bold active:translate-y-[2px]"
              >
                {o}
              </button>
            ))}
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (given.trim()) evaluate(given);
            }}
          >
            <input
              ref={inputRef}
              value={given}
              onChange={(e) => setGiven(e.target.value)}
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              aria-label="Doplň slovo"
              placeholder="Doplň slovo"
              className="w-full h-14 rounded-2xl border-2 border-line bg-card px-4 text-xl font-bold text-center focus:border-sky outline-none"
            />
            <BottomBar>
              <Button type="submit" size="xl" disabled={!given.trim()}>
                Skontrolovať
              </Button>
            </BottomBar>
          </form>
        ))}

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
