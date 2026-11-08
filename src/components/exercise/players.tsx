"use client";

import { Fragment, useState } from "react";
import { Button, Card, cx } from "@/components/ui";
import {
  GAP,
  type Answer,
  type ClozePayload,
  type ExerciseType,
  type McqPayload,
  type OrderPayload,
  type PairsPayload,
  type Payload,
  type TrueFalsePayload,
} from "@/lib/exercises";
import { shuffle } from "@/lib/plan";

export type PlayerProps = { payload: Payload; done: boolean; onSubmit: (a: Answer) => void };

const Question = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xl sm:text-2xl font-black leading-snug text-center break-words">{children}</p>
);

const tile = "rounded-2xl border-2 border-b-[6px] font-bold transition active:translate-y-[2px] active:border-b-2 disabled:pointer-events-none";

function Mcq({ payload, done, onSubmit }: PlayerProps) {
  const p = payload as McqPayload;
  const multi = p.correct.length > 1;
  const [picked, setPicked] = useState<number[]>([]);
  const toggle = (i: number) => {
    if (done) return;
    if (!multi) {
      setPicked([i]);
      onSubmit({ type: "mcq", picked: [i] });
      return;
    }
    setPicked((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]));
  };
  return (
    <div className="space-y-4">
      <Card className="px-4 py-6">
        <Question>{p.question}</Question>
        {multi && <p className="text-center text-sm font-bold text-sky mt-2">Správne sú {p.correct.length} odpovede</p>}
      </Card>
      <div className="grid gap-3">
        {p.options.map((o, i) => {
          const on = picked.includes(i);
          const good = done && p.correct.includes(i);
          const bad = done && on && !p.correct.includes(i);
          return (
            <button
              key={i}
              type="button"
              disabled={done}
              aria-pressed={on}
              onClick={() => toggle(i)}
              className={cx(
                tile,
                "px-4 py-3.5 text-left text-lg",
                good
                  ? "bg-leaf-soft border-leaf text-leaf"
                  : bad
                    ? "bg-tomato-soft border-tomato text-tomato"
                    : on
                      ? "bg-sun-soft border-sun-deep"
                      : "bg-card border-line",
              )}
            >
              {o}
            </button>
          );
        })}
      </div>
      {multi && !done && (
        <Button size="xl" variant="primary" disabled={!picked.length} onClick={() => onSubmit({ type: "mcq", picked })}>
          Skontrolovať
        </Button>
      )}
    </div>
  );
}

function TrueFalse({ payload, done, onSubmit }: PlayerProps) {
  const p = payload as TrueFalsePayload;
  const [picked, setPicked] = useState<boolean | null>(null);
  const choose = (v: boolean) => {
    if (done) return;
    setPicked(v);
    onSubmit({ type: "truefalse", picked: v });
  };
  return (
    <div className="space-y-4">
      <Card className="px-4 py-7">
        <Question>{p.statement}</Question>
      </Card>
      <div className="grid grid-cols-2 gap-3">
        {[true, false].map((v) => {
          const on = picked === v;
          const good = done && p.answer === v;
          const bad = done && on && p.answer !== v;
          return (
            <button
              key={String(v)}
              type="button"
              disabled={done}
              aria-pressed={on}
              onClick={() => choose(v)}
              className={cx(
                tile,
                "h-20 text-2xl",
                good
                  ? "bg-leaf-soft border-leaf text-leaf"
                  : bad
                    ? "bg-tomato-soft border-tomato text-tomato"
                    : on
                      ? "bg-sun-soft border-sun-deep"
                      : "bg-card border-line",
              )}
            >
              {v ? "Pravda" : "Nepravda"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Spájanie dvojíc. Uhádnutá dvojica zmizne z hracej plochy a presunie sa dole,
 * kde si ju žiak môže prečítať — plocha sa tým postupne vyprázdňuje a ostáva
 * na nej len to, čo ešte treba vyriešiť.
 *
 * Hodnotí sa prvý pokus pri každej položke, nie konečný stav: inak by sa dalo
 * k správnej odpovedi doklikať skúšaním.
 */
function Pairs({ payload, done, onSubmit }: PlayerProps) {
  const p = payload as PairsPayload;
  const [rightOrder] = useState(() => shuffle(p.pairs.map((_, i) => i)));
  const [left, setLeft] = useState<number | null>(null);
  const [solved, setSolved] = useState<number[]>([]);
  const [firstTry, setFirstTry] = useState<Record<number, number>>({});
  const [miss, setMiss] = useState<{ l: number; r: number } | null>(null);

  const openLeft = p.pairs.map((_, i) => i).filter((i) => !solved.includes(i));
  const openRight = rightOrder.filter((r) => !solved.includes(r));

  function pickRight(r: number) {
    if (done || left === null || miss) return;
    const tries = left in firstTry ? firstTry : { ...firstTry, [left]: r };
    setFirstTry(tries);

    if (r === left) {
      const next = [...solved, left];
      setSolved(next);
      setLeft(null);
      if (next.length === p.pairs.length) {
        onSubmit({ type: "pairs", matched: p.pairs.map((_, i) => [i, tries[i] ?? i] as [number, number]) });
      }
      return;
    }
    // zlá dvojica: na chvíľu sa červeno ukáže a plocha sa vráti do pôvodného stavu
    setMiss({ l: left, r });
    setTimeout(() => {
      setMiss(null);
      setLeft(null);
    }, 700);
  }

  const cell = "px-3 py-3 text-base h-full flex items-center justify-center text-center leading-snug";

  return (
    <div className="space-y-4">
      <p className="text-center text-base font-bold text-slate">{p.prompt ?? "Spoj, čo patrí k sebe"}</p>

      {openLeft.length > 0 && (
        // jedna mriežka pre oba stĺpce: bunky v rovnakom riadku sú tým pádom
        // rovnako vysoké aj vtedy, keď sa text na jednej strane zalomí
        <div className="grid grid-cols-2 gap-3 items-stretch">
          {openLeft.map((i, row) => {
            const r = openRight[row];
            return (
              <Fragment key={i}>
                <button
                  type="button"
                  disabled={done || !!miss}
                  aria-pressed={left === i}
                  onClick={() => setLeft(i)}
                  className={cx(tile, cell, miss?.l === i ? "bg-tomato-soft border-tomato text-tomato" : left === i ? "bg-sky-soft border-sky" : "bg-card border-line")}
                >
                  {p.pairs[i].left}
                </button>
                <button
                  type="button"
                  disabled={done || !!miss || left === null}
                  onClick={() => pickRight(r)}
                  className={cx(
                    tile,
                    cell,
                    miss?.r === r ? "bg-tomato-soft border-tomato text-tomato" : left === null ? "bg-card border-line opacity-60" : "bg-card border-line",
                  )}
                >
                  {p.pairs[r].right}
                </button>
              </Fragment>
            );
          })}
        </div>
      )}

      {solved.length > 0 && (
        <div className="rounded-2xl bg-leaf-soft/50 border border-leaf/30 p-3">
          <p className="text-sm font-black text-leaf mb-2">Spojené ({solved.length} z {p.pairs.length})</p>
          <ul className="space-y-1.5">
            {solved.map((i) => (
              <li key={i} className="text-base font-bold leading-snug">
                {p.pairs[i].left} <span className="text-leaf">–</span> {p.pairs[i].right}
                {firstTry[i] !== i && <span className="ml-1.5 text-sm font-bold text-tomato">(na druhý pokus)</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!done && !miss && <p className="text-center text-sm text-slate font-semibold">{left === null ? "Ťukni vľavo" : "Teraz vyber vpravo"}</p>}
      {miss && <p className="text-center text-sm font-black text-tomato">Toto k sebe nepatrí, skús inú dvojicu.</p>}
    </div>
  );
}

function Cloze({ payload, done, onSubmit }: PlayerProps) {
  const p = payload as ClozePayload;
  const parts = p.text.split(GAP);
  const [bank] = useState(() => shuffle(p.options));
  const [filled, setFilled] = useState<(string | null)[]>(() => p.answers.map(() => null));
  const used = filled.filter(Boolean) as string[];
  const next = filled.findIndex((f) => f === null);

  function put(word: string) {
    if (done || next < 0) return;
    const out = [...filled];
    out[next] = word;
    setFilled(out);
    if (!out.some((x) => x === null)) onSubmit({ type: "cloze", filled: out as string[] });
  }
  const clear = (i: number) => {
    if (done) return;
    const out = [...filled];
    out[i] = null;
    setFilled(out);
  };

  return (
    <div className="space-y-4">
      <Card className="px-4 py-6">
        <p className="text-lg sm:text-xl font-bold leading-relaxed text-center">
          {parts.map((part, i) => (
            <span key={i}>
              {part}
              {i < parts.length - 1 &&
                (() => {
                  const ok = done && p.answers[i].toLocaleLowerCase("sk") === (filled[i] ?? "").toLocaleLowerCase("sk");
                  return (
                    <button
                      type="button"
                      onClick={() => clear(i)}
                      disabled={done || !filled[i]}
                      className={cx(
                        "mx-1 inline-block min-w-24 rounded-lg border-2 px-2 font-black",
                        done
                          ? ok
                            ? "bg-leaf-soft border-leaf text-leaf"
                            : "bg-tomato-soft border-tomato text-tomato"
                          : filled[i]
                            ? "bg-sun-soft border-sun-deep"
                            : "border-dashed border-sun-deep bg-card",
                      )}
                    >
                      {done && !ok ? p.answers[i] : (filled[i] ?? "   ")}
                    </button>
                  );
                })()}
            </span>
          ))}
        </p>
      </Card>
      {!done && (
        <div className="flex flex-wrap justify-center gap-2">
          {bank.map((w) => (
            <button
              key={w}
              type="button"
              disabled={used.includes(w)}
              onClick={() => put(w)}
              className={cx(tile, "px-3 py-2 text-base", used.includes(w) ? "bg-paper border-line text-mist" : "bg-card border-line")}
            >
              {w}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Order({ payload, done, onSubmit }: PlayerProps) {
  const p = payload as OrderPayload;
  const [pool] = useState(() => shuffle(p.items.map((_, i) => i)));
  const [picked, setPicked] = useState<number[]>([]);

  function add(i: number) {
    if (done || picked.includes(i)) return;
    const next = [...picked, i];
    setPicked(next);
    if (next.length === p.items.length) onSubmit({ type: "order", order: next });
  }

  return (
    <div className="space-y-4">
      <p className="text-center text-base font-bold text-slate">{p.prompt}</p>
      <div className="space-y-2">
        {pool.map((i) => {
          const at = picked.indexOf(i);
          const ok = done && at === i;
          const bad = done && at >= 0 && at !== i;
          return (
            <button
              key={i}
              type="button"
              disabled={done || at >= 0}
              onClick={() => add(i)}
              className={cx(
                tile,
                "w-full flex items-center gap-3 px-3 py-3 text-left text-base",
                ok
                  ? "bg-leaf-soft border-leaf text-leaf"
                  : bad
                    ? "bg-tomato-soft border-tomato text-tomato"
                    : at >= 0
                      ? "bg-sun-soft border-sun-deep"
                      : "bg-card border-line",
              )}
            >
              <span
                className={cx(
                  "size-8 shrink-0 inline-flex items-center justify-center rounded-lg font-black",
                  at >= 0 ? "bg-ink text-white" : "bg-paper text-mist",
                )}
              >
                {at >= 0 ? at + 1 : "?"}
              </span>
              <span className="flex-1">{p.items[i]}</span>
              {done && <span className="text-sm font-black">{i + 1}.</span>}
            </button>
          );
        })}
      </div>
      {!done && <p className="text-center text-sm text-slate font-semibold">Ťukaj v správnom poradí</p>}
    </div>
  );
}

export const PLAYERS: Record<ExerciseType, (p: PlayerProps) => React.ReactElement> = {
  mcq: Mcq,
  truefalse: TrueFalse,
  pairs: Pairs,
  cloze: Cloze,
  order: Order,
};
