"use client";

import { Delete } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { normalize, nowMs, shuffle } from "@/lib/en/text";
import { Button, cx } from "@/components/ui";
import type { SessionCtx } from "../engine";
import { BottomBar, Progress, PromptCard, SentenceBox, useRequeue } from "../parts";

export type WritingItem = { id: string; en: string; sk: string; key: string; lesson_id?: string };
type Word = { text: string; id: number };

/** Words of a sentence without sentence punctuation, e.g. "I've got a dog." → ["I've", "got", "a", "dog"]. */
export function sentenceWords(en: string) {
  return en
    .replace(/[“”"]/g, "")
    .split(/\s+/)
    .map((w) => w.replace(/^[(¿¡]+|[.,!?;:)]+$/g, ""))
    .filter(Boolean);
}

const same = (a: string[], b: string[]) => a.length === b.length && a.every((w, i) => normalize(w) === normalize(b[i]));

/** Build an English sentence from shuffled word tiles, shown with its Slovak translation. */
export default function Writing({ items, ctx, onDone }: { items: WritingItem[]; ctx: SessionCtx; onDone: () => void }) {
  const q = useRequeue(items);
  const [pool, setPool] = useState<Word[]>([]);
  const [built, setBuilt] = useState<Word[]>([]);
  const [phase, setPhase] = useState<"build" | "retry" | "ok" | "wrong">("build");
  const [shake, setShake] = useState(false);
  const started = useRef(0);
  const item = q.current;
  const words = item ? sentenceWords(item.en) : [];

  useEffect(() => {
    if (q.done) onDone();
  }, [q.done, onDone]);

  useEffect(() => {
    if (!item) return;
    started.current = nowMs();
    const tiles = words.map((text, id) => ({ text, id }));
    let mixed = shuffle(tiles);
    for (
      let i = 0;
      i < 4 &&
      tiles.length > 1 &&
      same(
        mixed.map((w) => w.text),
        words,
      );
      i++
    )
      mixed = shuffle(tiles);
    setPool(mixed);
    setBuilt([]);
    setPhase("build");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.key]);

  useEffect(() => {
    if (!item || phase === "ok" || phase === "wrong") return;
    if (!words.length || built.length !== words.length) return;
    const attempt = built.map((w) => w.text);
    if (same(attempt, words)) {
      setPhase("ok");
      ctx.record({
        activity: "writing",
        itemType: "sentence",
        itemId: item.id,
        correct: true,
        hinted: phase === "retry",
        given: attempt.join(" "),
        responseMs: nowMs() - started.current,
      });
      ctx.say(item.en, "en");
    } else if (phase === "build") {
      setShake(true);
      setTimeout(() => {
        setShake(false);
        setPool((p) => shuffle([...p, ...built]));
        setBuilt([]);
        setPhase("retry");
      }, 550);
    } else {
      setPhase("wrong");
      ctx.record({ activity: "writing", itemType: "sentence", itemId: item.id, correct: false, given: attempt.join(" ") });
      q.requeue(item);
      ctx.say(item.en, "en");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [built]);

  if (!item) return null;
  const finished = phase === "ok" || phase === "wrong";

  const tile = "inline-flex items-center h-11 px-3 rounded-xl border-2 border-b-4 text-lg font-bold";

  return (
    <div className="flex flex-col gap-5 flex-1">
      <Progress value={q.index} total={q.queue.length} />
      <PromptCard key={item.key} text={item.sk} lang="sk" ctx={ctx} />
      <p className="text-center text-sm font-bold text-slate">{phase === "retry" ? "Skoro! Skús poradie slov ešte raz." : "Poskladaj vetu po anglicky"}</p>

      <div
        className={cx("min-h-[4.5rem] rounded-2xl border-2 border-dashed border-line px-2 py-2 flex flex-wrap content-start gap-1.5", shake && "anim-shake")}
        aria-live="polite"
        aria-label="Tvoja veta"
      >
        {phase === "wrong"
          ? words.map((w, i) => (
              <span key={i} className={cx(tile, "bg-leaf-soft border-leaf text-leaf")}>
                {w}
              </span>
            ))
          : built.map((w) => (
              <button
                key={w.id}
                type="button"
                disabled={finished}
                className={cx(
                  tile,
                  phase === "ok" ? "bg-leaf-soft border-leaf text-leaf" : shake ? "bg-tomato-soft border-tomato text-tomato" : "bg-sun-soft border-sun-deep",
                )}
                onClick={() => {
                  setBuilt((b) => b.filter((x) => x.id !== w.id));
                  setPool((p) => [...p, w]);
                }}
              >
                {w.text}
              </button>
            ))}
      </div>

      {!finished && (
        <div className="flex flex-wrap justify-center gap-2">
          {pool.map((w) => (
            <button
              key={w.id}
              type="button"
              className={cx(tile, "bg-card border-line active:translate-y-[2px]")}
              onClick={() => {
                setPool((p) => p.filter((x) => x.id !== w.id));
                setBuilt((b) => [...b, w]);
              }}
            >
              {w.text}
            </button>
          ))}
          {built.length > 0 && (
            <button
              type="button"
              aria-label="Vrátiť posledné slovo"
              className={cx(tile, "bg-card border-line text-slate")}
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

      {phase === "wrong" && <p className="text-center font-bold text-tomato">Správne poradie je vyššie. Táto veta sa ešte vráti.</p>}
      {finished && <SentenceBox en={item.en} sk={item.sk} ctx={ctx} />}
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
