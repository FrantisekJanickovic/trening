"use client";

import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { canRecognize, listen, type Listening } from "@/lib/en/speech";
import type { Lang } from "@/lib/en/types";
import { cx, SpeakButton } from "@/components/ui";
import type { SessionCtx } from "./engine";

/** Letter tiles: show the answer slots, what the child typed, revealed hints, or the final state. */
export function Tiles({
  answer,
  typed,
  revealed = 0,
  state = "idle",
  showSlots = true,
}: {
  answer: string;
  typed: string;
  revealed?: number;
  state?: "idle" | "ok" | "bad" | "solution";
  showSlots?: boolean;
}) {
  const target = Array.from(answer);
  if (!showSlots && state === "idle") {
    const t = Array.from(typed);
    return (
      <div className="flex flex-wrap justify-center gap-1.5 min-h-[2.6rem]" aria-live="polite">
        {t.length === 0 ? (
          <span className="tile opacity-40">?</span>
        ) : (
          t.map((c, i) =>
            c === " " ? (
              <span key={i} className="w-3" />
            ) : (
              <span key={i} className="tile tile-filled anim-pop">
                {c}
              </span>
            ),
          )
        )}
      </div>
    );
  }
  const typedChars = Array.from(typed.replace(/\s+/g, " "));
  let ti = 0;
  return (
    <div className={cx("flex flex-wrap justify-center gap-1.5", state === "bad" && "anim-shake")} aria-live="polite">
      {target.map((c, i) => {
        if (c === " ") {
          if (typedChars[ti] === " ") ti++;
          return <span key={i} className="w-3" />;
        }
        const ch = typedChars[ti];
        ti++;
        let cls = "tile";
        let shown = "";
        if (state === "solution") {
          shown = c;
          cls += " tile-ok";
        } else if (ch && ch !== " ") {
          shown = ch;
          cls += state === "ok" ? " tile-ok" : state === "bad" ? " tile-bad" : " tile-filled";
        } else if (i < revealed + countSpacesBefore(target, i)) {
          shown = c;
          cls += " tile-revealed";
        }
        return (
          <span key={i} className={cls}>
            {shown}
          </span>
        );
      })}
      {typedChars.length > target.length && state !== "solution" && (
        <span className={cx("tile", state === "bad" ? "tile-bad" : "tile-filled")}>{typedChars.slice(target.length).join("")}</span>
      )}
    </div>
  );
}

function countSpacesBefore(chars: string[], i: number) {
  let n = 0;
  for (let k = 0; k < i; k++) if (chars[k] === " ") n++;
  return n;
}

export function PromptCard({
  text,
  lang,
  emoji,
  ctx,
  sub,
  autoSpeak,
}: {
  text: string;
  lang: Lang;
  emoji?: string | null;
  ctx: SessionCtx;
  sub?: ReactNode;
  autoSpeak?: boolean;
}) {
  useEffect(() => {
    if (autoSpeak) ctx.say(text, lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, lang, autoSpeak]);
  return (
    <div className="rounded-[2rem] bg-card border-2 border-line border-b-[6px] px-5 py-7 text-center anim-rise">
      {ctx.showEmoji && emoji && <div className="text-6xl mb-2 leading-none">{emoji}</div>}
      <div className="flex items-center justify-center gap-3">
        <span className="text-[2.1rem] leading-tight font-black break-words">{text}</span>
        <SpeakButton onClick={() => ctx.say(text, lang)} />
      </div>
      <div className="mt-1 text-sm font-bold text-mist">{lang === "en" ? "anglicky" : "slovensky"}</div>
      {sub}
    </div>
  );
}

export function SentenceBox({ en, sk, ctx }: { en?: string | null; sk?: string | null; ctx: SessionCtx }) {
  if (!en) return null;
  return (
    <div className="rounded-2xl bg-sky-soft px-4 py-3 flex items-start gap-3 anim-rise text-left">
      <SpeakButton size="sm" onClick={() => ctx.say(en, "en")} />
      <div>
        <div className="font-bold text-ink">{en}</div>
        {sk && <div className="text-ink-soft">{sk}</div>}
      </div>
    </div>
  );
}

export function BottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-4 px-4 pt-3 bg-gradient-to-t from-paper via-paper to-paper/0 safe-bottom">
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

export function MicButton({ lang, onResult, disabled }: { lang: Lang; onResult: (alts: string[]) => void; disabled?: boolean }) {
  const [state, setState] = useState<"idle" | "listening" | "error">("idle");
  const ref = useRef<Listening | null>(null);
  const supported = canRecognize();

  async function start() {
    if (state === "listening") {
      ref.current?.stop();
      return;
    }
    setState("listening");
    const l = listen(lang);
    ref.current = l;
    try {
      const alts = await l.result;
      setState("idle");
      onResult(alts);
    } catch {
      setState("error");
    }
  }

  if (!supported) return <p className="text-sm text-slate text-center">Tento prehliadač nevie rozpoznávať reč. Odpovedz písomne.</p>;

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={start}
        disabled={disabled}
        aria-label={state === "listening" ? "Zastaviť" : "Povedať odpoveď"}
        className={cx(
          "size-20 rounded-full flex items-center justify-center text-white border-b-4 transition disabled:opacity-40",
          state === "listening" ? "bg-tomato border-[#a32f33] animate-pulse" : "bg-ink border-[#0f1640] active:translate-y-[2px] active:border-b-2",
        )}
      >
        {state === "listening" ? <Square className="size-7" /> : <Mic className="size-8" />}
      </button>
      <span className="text-sm font-bold text-slate">
        {state === "listening" ? "Počúvam…" : state === "error" ? "Mikrofón nefunguje, skús znova" : `Povedz ${lang === "en" ? "anglicky" : "slovensky"}`}
      </span>
    </div>
  );
}

export function Progress({ value, total }: { value: number; total: number }) {
  const pct = total ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="h-3 rounded-full bg-line overflow-hidden" role="progressbar" aria-valuenow={value} aria-valuemax={total}>
      <div className="h-full bg-sun rounded-full transition-[width] duration-300" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Queue of items that re-inserts misses a few positions later (max twice per item). */
export function useRequeue<T extends { key: string }>(initial: T[]) {
  const [queue, setQueue] = useState(initial);
  const [index, setIndex] = useState(0);
  const repeats = useRef(new Map<string, number>());
  const requeue = (item: T) => {
    const n = repeats.current.get(item.key) ?? 0;
    if (n >= 2) return;
    repeats.current.set(item.key, n + 1);
    setQueue((q) => {
      const pos = Math.min(q.length, index + 3);
      return [...q.slice(0, pos), { ...item }, ...q.slice(pos)];
    });
  };
  return { queue, index, current: queue[index], next: () => setIndex((i) => i + 1), requeue, done: index >= queue.length };
}
