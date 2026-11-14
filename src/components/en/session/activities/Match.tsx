"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { shuffle } from "@/lib/en/text";
import { Button, cx } from "@/components/ui";
import type { DrillItem, SessionCtx } from "../engine";
import { BottomBar, Progress } from "../parts";

const ROUND = 5;

export default function Match({ items, ctx, onDone }: { items: DrillItem[]; ctx: SessionCtx; onDone: () => void }) {
  const rounds = useMemo(() => {
    const r: DrillItem[][] = [];
    for (let i = 0; i < items.length; i += ROUND) r.push(items.slice(i, i + ROUND));
    // avoid a lonely last pair
    if (r.length > 1 && r[r.length - 1].length < 2) r[r.length - 2].push(...r.pop()!);
    return r;
  }, [items]);
  const [round, setRound] = useState(0);
  const [left, setLeft] = useState<DrillItem[]>([]);
  const [right, setRight] = useState<DrillItem[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [bad, setBad] = useState<string[]>([]);
  const erred = useRef(new Set<string>());
  const [seconds, setSeconds] = useState(0);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });

  useEffect(() => {
    const cur = rounds[round];
    if (!cur) {
      doneRef.current();
      return;
    }
    setLeft(shuffle(cur));
    setRight(shuffle(cur));
    setMatched(new Set());
    setPicked(null);
    erred.current = new Set();
  }, [round, rounds]);

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const cur = rounds[round] ?? [];
  const roundDone = cur.length > 0 && matched.size === cur.length;

  useEffect(() => {
    if (!roundDone) return;
    for (const it of cur) {
      ctx.record({ activity: "match", itemType: "vocab", itemId: it.id, correct: !erred.current.has(it.id), recognition: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundDone]);

  function pickRight(it: DrillItem) {
    if (!picked || matched.has(it.id)) return;
    if (picked === it.id) {
      setMatched((m) => new Set(m).add(it.id));
      ctx.say(it.en, "en");
      setPicked(null);
    } else {
      erred.current.add(picked);
      setBad([picked, it.id]);
      setTimeout(() => setBad([]), 450);
      setPicked(null);
    }
  }

  const tile = (active: boolean, done: boolean, isBad: boolean) =>
    cx(
      "w-full min-h-14 rounded-2xl border-2 border-b-4 px-3 py-2 text-lg font-bold transition",
      done
        ? "opacity-0 pointer-events-none scale-95"
        : isBad
          ? "bg-tomato-soft border-tomato anim-shake"
          : active
            ? "bg-sun-soft border-sun-deep"
            : "bg-card border-line active:translate-y-[2px]",
    );

  return (
    <div className="flex flex-col gap-5 flex-1">
      <Progress value={round} total={rounds.length} />
      <div className="flex justify-between text-sm font-bold text-slate">
        <span>Spoj dvojice</span>
        {ctx.settings.methods.gamification && <span className="tabular-nums">{seconds} s</span>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-3">
          {left.map((it) => (
            <button
              key={it.id}
              type="button"
              className={tile(picked === it.id, matched.has(it.id), bad[0] === it.id)}
              onClick={() => !matched.has(it.id) && setPicked(it.id)}
            >
              {it.en}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {right.map((it) => (
            <button key={it.id} type="button" className={tile(false, matched.has(it.id), bad[1] === it.id)} onClick={() => pickRight(it)}>
              {ctx.showEmoji && it.emoji ? `${it.emoji} ` : ""}
              {it.sk}
            </button>
          ))}
        </div>
      </div>
      {roundDone && (
        <BottomBar>
          <Button size="xl" variant="leaf" onClick={() => setRound((r) => r + 1)} autoFocus>
            {round + 1 < rounds.length ? "Ďalšie kolo" : "Hotovo"}
          </Button>
        </BottomBar>
      )}
    </div>
  );
}
