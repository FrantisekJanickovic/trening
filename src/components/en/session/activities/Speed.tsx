"use client";

import { Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { displayAnswer, shuffle } from "@/lib/en/text";
import { Button, cx } from "@/components/ui";
import type { DrillItem, SessionCtx } from "../engine";
import { BottomBar } from "../parts";

const SECONDS = 60;

export default function Speed({ items, pool, ctx, onDone }: { items: DrillItem[]; pool: DrillItem[]; ctx: SessionCtx; onDone: () => void }) {
  const [phase, setPhase] = useState<"ready" | "run" | "end">("ready");
  const [left, setLeft] = useState(SECONDS);
  const [i, setI] = useState(0);
  const [score, setScore] = useState({ ok: 0, total: 0 });
  const [flash, setFlash] = useState<{ id: string; ok: boolean } | null>(null);
  const order = useMemo(() => shuffle(items), [items]);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (phase !== "run") return;
    const t = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase === "run" && left <= 0) {
      setPhase("end");
      ctx.announce(`${score.ok} správnych za minútu!`, ctx.settings.motivation);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, phase]);

  const item = order.length ? order[i % order.length] : null;
  const toEn = item?.dir === "sk_en";

  const options = useMemo(() => {
    if (!item) return [];
    const label = (x: DrillItem) => displayAnswer(toEn ? x.en : x.sk);
    const correct = label(item);
    const others = shuffle(pool.filter((p) => p.id !== item.id && label(p) !== correct)).slice(0, 3);
    return shuffle([{ id: item.id, text: correct }, ...others.map((o) => ({ id: o.id, text: label(o) }))]);
  }, [item, pool, toEn]);

  useEffect(() => {
    if (!order.length) onDone();
  }, [order.length, onDone]);

  if (!item) return null;

  function answer(id: string) {
    if (flash || phase !== "run" || !item) return;
    const ok = id === item.id;
    setFlash({ id, ok });
    setScore((s) => ({ ok: s.ok + (ok ? 1 : 0), total: s.total + 1 }));
    // only the first answer for each word goes into the spaced repetition
    if (!seen.current.has(item.id) || !ok) {
      ctx.record({ activity: "speed", itemType: "vocab", itemId: item.id, correct: ok, recognition: true, direction: item.dir });
      seen.current.add(item.id);
    }
    setTimeout(
      () => {
        setFlash(null);
        setI((x) => x + 1);
      },
      ok ? 250 : 650,
    );
  }

  if (phase === "ready")
    return (
      <div className="flex flex-col gap-6 flex-1 items-center justify-center text-center">
        <Zap className="size-14 text-sun-deep" />
        <h2 className="text-3xl font-black">Blesková runda</h2>
        <p className="text-slate font-semibold max-w-xs">Máš {SECONDS} sekúnd. Vyber správny preklad čo najrýchlejšie.</p>
        <BottomBar>
          <Button size="xl" variant="sun" onClick={() => setPhase("run")} autoFocus>
            Štart
          </Button>
        </BottomBar>
      </div>
    );

  if (phase === "end")
    return (
      <div className="flex flex-col gap-4 flex-1 items-center justify-center text-center">
        <div className="text-7xl font-black text-ink">{score.ok}</div>
        <p className="text-xl font-bold text-slate">správnych z {score.total} za minútu</p>
        <BottomBar>
          <Button size="xl" onClick={onDone} autoFocus>
            Ďalej
          </Button>
        </BottomBar>
      </div>
    );

  return (
    <div className="flex flex-col gap-5 flex-1">
      <div className="flex items-center gap-3">
        <div className="h-3 flex-1 rounded-full bg-line overflow-hidden">
          <div
            className={cx("h-full rounded-full transition-[width] duration-1000 ease-linear", left <= 10 ? "bg-tomato" : "bg-sun")}
            style={{ width: `${(left / SECONDS) * 100}%` }}
          />
        </div>
        <span className="font-black tabular-nums w-10 text-right">{left}s</span>
      </div>
      <div className="text-center font-black text-sm text-leaf">{score.ok} správne</div>
      <div className="rounded-[2rem] bg-card border-2 border-line border-b-[6px] py-8 text-center">
        {ctx.showEmoji && item.emoji && <div className="text-5xl mb-2">{item.emoji}</div>}
        <div className="text-4xl font-black">{toEn ? item.sk : item.en}</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => answer(o.id)}
            className={cx(
              "min-h-16 rounded-2xl border-2 border-b-4 px-3 text-lg font-bold transition",
              flash && o.id === item.id
                ? "bg-leaf-soft border-leaf text-leaf"
                : flash?.id === o.id && !flash.ok
                  ? "bg-tomato-soft border-tomato text-tomato"
                  : "bg-card border-line active:translate-y-[2px]",
            )}
          >
            {o.text}
          </button>
        ))}
      </div>
    </div>
  );
}
