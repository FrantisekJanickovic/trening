"use client";

import { Volume2 } from "lucide-react";
import { cx } from "@/components/ui";

export type GuideId = "female" | "male";

export const GUIDES: Record<GuideId, { name: string; hello: { en: string; sk: string } }> = {
  female: { name: "Ema", hello: { en: "Hello! I'm Ema.", sk: "Ahoj! Budem ťa sprevádzať pri tréningu angličtiny." } },
  male: { name: "Leo", hello: { en: "Hi there! I'm Leo.", sk: "Ahoj! Poďme spolu trénovať angličtinu." } },
};

const NAVY = "#1b2559";

function Headset() {
  return (
    <g>
      <path d="M29 64 C29 25, 91 25, 91 64" stroke={NAVY} strokeWidth="5" fill="none" strokeLinecap="round" />
      <rect x="22" y="56" width="11" height="19" rx="5.5" fill={NAVY} />
      <rect x="87" y="56" width="11" height="19" rx="5.5" fill={NAVY} />
      <path d="M92 74 C92 86, 82 90, 72 88" stroke={NAVY} strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="70" cy="88" r="4" fill="#ffc83d" stroke={NAVY} strokeWidth="1.5" />
    </g>
  );
}

function Face({ skin }: { skin: string }) {
  return (
    <g>
      <rect x="52" y="84" width="16" height="12" fill={skin} />
      <ellipse cx="60" cy="65" rx="25" ry="27" fill={skin} />
      <circle cx="50" cy="66" r="3.4" fill={NAVY} />
      <circle cx="70" cy="66" r="3.4" fill={NAVY} />
      <circle cx="51.2" cy="64.8" r="1.1" fill="#fff" />
      <circle cx="71.2" cy="64.8" r="1.1" fill="#fff" />
      <circle cx="44" cy="75" r="4.2" fill="#f59aa0" opacity="0.55" />
      <circle cx="76" cy="75" r="4.2" fill="#f59aa0" opacity="0.55" />
      <path d="M51 78 Q60 87 69 78" stroke={NAVY} strokeWidth="3" fill="none" strokeLinecap="round" />
    </g>
  );
}

export function GuideFace({ id, className }: { id: GuideId; className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      {id === "female" ? (
        <>
          <circle cx="60" cy="60" r="58" fill="#ffe7a3" />
          <path d="M23 64 C21 26, 99 26, 97 64 L97 90 C97 97, 88 99, 84 93 L84 66 L36 66 L36 93 C32 99, 23 97, 23 90 Z" fill="#5b3a29" />
          <path d="M24 120 C27 101, 43 93, 60 93 C77 93, 93 101, 96 120 Z" fill="#3d6cf0" />
          <Face skin="#f6cba5" />
          <path d="M34 58 C36 36, 84 33, 87 58 C79 47, 66 43, 55 47 C47 50, 40 53, 34 58 Z" fill="#5b3a29" />
          <circle cx="82" cy="40" r="5" fill="#e5484d" />
        </>
      ) : (
        <>
          <circle cx="60" cy="60" r="58" fill="#cfe0ff" />
          <path d="M24 120 C27 101, 43 93, 60 93 C77 93, 93 101, 96 120 Z" fill="#1f9d63" />
          <Face skin="#edb98f" />
          <path d="M34 60 C30 36, 48 27, 61 30 C76 27, 92 37, 86 60 C82 50, 73 45, 63 47 C52 44, 41 49, 34 60 Z" fill="#2e2a3a" />
          <path d="M54 31 C56 22, 66 21, 70 28" stroke="#2e2a3a" strokeWidth="6" fill="none" strokeLinecap="round" />
        </>
      )}
      <Headset />
    </svg>
  );
}

/** A voice guide the child can pick; stays pressed while selected. */
export function GuideButton({ id, selected, playing, onSelect }: { id: GuideId; selected: boolean; playing: boolean; onSelect: () => void }) {
  const g = GUIDES[id];
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cx(
        "relative flex flex-col items-center gap-2 rounded-3xl border-2 px-3 pt-4 pb-3 transition-all",
        selected
          ? "bg-sun-soft border-sun-deep border-b-2 translate-y-[4px] shadow-inner"
          : "bg-card border-line border-b-[6px] hover:border-mist active:translate-y-[2px]",
      )}
    >
      <GuideFace id={id} className={cx("size-24 sm:size-28 transition-transform", selected && "scale-95")} />
      <span className="text-xl font-black">{g.name}</span>
      <span className={cx("inline-flex items-center gap-1 text-sm font-bold", selected ? "text-sun-deep" : "text-slate")}>
        <Volume2 className={cx("size-4", playing && "animate-pulse")} />{" "}
        {playing ? "Hovorí…" : selected ? (id === "female" ? "Vybraná" : "Vybraný") : "Vypočuť"}
      </span>
    </button>
  );
}
