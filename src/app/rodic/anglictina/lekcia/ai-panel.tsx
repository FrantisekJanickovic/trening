"use client";

import { Check, Copy, Sparkles } from "lucide-react";
import { useState } from "react";
import PromptBox from "@/components/prompt-box";
import { ErrorNote, cx } from "@/components/ui";
import { reviseItem } from "@/lib/en/ai";
import { actionsFor, codesIn, type ItemKind, type Ref } from "@/lib/en/revise";

/** Kód položky. Rodič ho prepíše do pokynu pre AI, tak sa dá aj skopírovať. */
export function CodeChip({ code }: { code?: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!code) return <span className="rounded-md bg-ink/5 px-1.5 py-0.5 font-mono text-xs font-black text-mist">nové</span>;
  return (
    <button
      type="button"
      title="Skopírovať kód položky"
      aria-label={`Kód položky ${code}`}
      onClick={() => {
        navigator.clipboard?.writeText(code).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="inline-flex items-center gap-1 rounded-md bg-ink/5 px-1.5 py-0.5 font-mono text-xs font-black text-slate hover:bg-ink/10"
    >
      {code}
      {copied ? <Check className="size-3 text-leaf" /> : <Copy className="size-3 opacity-60" />}
    </button>
  );
}

type Props = {
  kind: ItemKind;
  code?: string | null;
  label: string;
  ai: boolean;
  disabled?: boolean;
  /** položka tak, ako ju má dostať AI */
  target: Record<string, unknown>;
  grade?: number | null;
  title?: string;
  topic?: string;
  /** čo už v lekcii je, nech AI nevyrobí to isté znova */
  existing: string[];
  /** položky, na ktoré sa dá v prompte odvolať kódom */
  known: Ref[];
  onFixed: (item: Record<string, unknown>) => void;
  onAdd: (items: Record<string, unknown>[]) => void;
};

/** Pokyn pre AI k jednej položke lekcie — predvoľby aj vlastný text. */
export default function AiPanel({ kind, code, label, ai, disabled, target, grade, title, topic, existing, known, onFixed, onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: string) {
    setBusy(action);
    setError(null);
    setNote(null);
    try {
      const refs = codesIn(text.trim()).filter((c) => c !== code && known.some((k) => k.code === c));
      const r = await reviseItem({
        kind,
        action,
        instruction: text.trim(),
        grade,
        title,
        topic,
        target,
        refs: known.filter((k) => refs.includes(k.code)),
        existing,
        count: 5,
      });
      const parts: string[] = [];
      if (r.fixed) {
        onFixed(r.fixed);
        parts.push("položka je upravená");
      }
      if (r.items.length) {
        onAdd(r.items);
        parts.push(`pridaných ${r.items.length}`);
      }
      setText("");
      setNote(`${r.note}${parts.length ? ` (${parts.join(", ")})` : ""}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pokyn sa nepodarilo spracovať.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <CodeChip code={code} />
        <button
          type="button"
          aria-label={`Pokyn pre AI k položke ${code ?? label}`}
          disabled={disabled}
          onClick={() => {
            setOpen(!open);
            setText("");
            setNote(null);
            setError(null);
          }}
          className={cx(
            "size-7 inline-flex items-center justify-center rounded-lg hover:bg-ink/5 disabled:opacity-40",
            open ? "text-sun-deep bg-sun-soft" : "text-slate",
          )}
        >
          <Sparkles className="size-4" />
        </button>
        {note && !open && <span className="text-xs font-bold text-leaf truncate">{note}</span>}
      </div>
      {open && (
        <>
          <PromptBox
            presets={actionsFor(kind)}
            value={text}
            onChange={setText}
            onRun={run}
            busy={busy}
            disabled={!ai || disabled}
            label={`Pokyn pre AI${code ? ` k položke ${code}` : ""}`}
            hint={ai ? "Na inú položku sa odvolaj jej kódom." : "AI je vypnutá, chýba kľúč vo Verceli."}
          />
          {note && <p className="rounded-xl bg-leaf-soft text-leaf px-3 py-2 text-sm font-semibold">{note}</p>}
          {error && <ErrorNote>{error}</ErrorNote>}
          <p className="text-xs font-semibold text-mist">Zmeny sa uložia až tlačidlom „Uložiť lekciu“.</p>
        </>
      )}
    </div>
  );
}
