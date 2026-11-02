"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useState } from "react";
import { Button, ErrorNote, Input, Segmented, Textarea, cx } from "@/components/ui";
import {
  cleanPayload,
  GAP,
  gapCount,
  type ClozePayload,
  type ExerciseType,
  type McqPayload,
  type OrderPayload,
  type PairsPayload,
  type Payload,
  type TrueFalsePayload,
} from "@/lib/exercises";

export type EditorProps = { payload: Payload; onChange: (p: Payload) => void };

const label = "block text-sm font-bold text-ink-soft mb-1";
const iconBtn = "size-9 inline-flex items-center justify-center rounded-lg text-mist hover:text-tomato hover:bg-tomato-soft shrink-0";

/** Prázdne cvičenie daného typu, keď rodič pridáva nové. */
export function emptyPayload(type: ExerciseType): Payload {
  if (type === "mcq") return { question: "", options: ["", "", ""], correct: [0], explain: "" };
  if (type === "truefalse") return { statement: "", answer: true, explain: "" };
  if (type === "pairs")
    return {
      prompt: "Spoj, čo patrí k sebe",
      pairs: [
        { left: "", right: "" },
        { left: "", right: "" },
        { left: "", right: "" },
      ],
    };
  if (type === "cloze") return { text: `Veta z lekcie s ${GAP} na doplnenie.`, answers: [""], options: ["", ""], explain: "" };
  return { prompt: "Zoraď udalosti od najstaršej", items: ["", "", ""] };
}

function McqEditor({ payload, onChange }: EditorProps) {
  const p = payload as McqPayload;
  const set = (patch: Partial<McqPayload>) => onChange({ ...p, ...patch });
  return (
    <div className="space-y-3">
      <label className="block">
        <span className={label}>Otázka</span>
        <Textarea rows={2} value={p.question} onChange={(e) => set({ question: e.target.value })} aria-label="Otázka" />
      </label>
      <div>
        <span className={label}>Možnosti (zaškrtni správne)</span>
        <div className="space-y-2">
          {p.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-5 shrink-0 accent-[var(--color-leaf)]"
                checked={p.correct.includes(i)}
                aria-label={`Možnosť ${i + 1} je správna`}
                onChange={(e) => set({ correct: e.target.checked ? [...p.correct, i].sort() : p.correct.filter((c) => c !== i) })}
              />
              <Input value={o} aria-label={`Možnosť ${i + 1}`} onChange={(e) => set({ options: p.options.map((x, j) => (j === i ? e.target.value : x)) })} />
              {p.options.length > 2 && (
                <button
                  type="button"
                  aria-label={`Zmazať možnosť ${i + 1}`}
                  className={iconBtn}
                  onClick={() =>
                    set({
                      options: p.options.filter((_, j) => j !== i),
                      correct: p.correct.filter((c) => c !== i).map((c) => (c > i ? c - 1 : c)),
                    })
                  }
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        {p.options.length < 6 && (
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => set({ options: [...p.options, ""] })}>
            <Plus className="size-4" /> Možnosť
          </Button>
        )}
      </div>
      <label className="block">
        <span className={label}>Vysvetlenie</span>
        <Input value={p.explain ?? ""} onChange={(e) => set({ explain: e.target.value })} aria-label="Vysvetlenie" />
      </label>
    </div>
  );
}

function TrueFalseEditor({ payload, onChange }: EditorProps) {
  const p = payload as TrueFalsePayload;
  const set = (patch: Partial<TrueFalsePayload>) => onChange({ ...p, ...patch });
  return (
    <div className="space-y-3">
      <label className="block">
        <span className={label}>Tvrdenie</span>
        <Textarea rows={2} value={p.statement} onChange={(e) => set({ statement: e.target.value })} aria-label="Tvrdenie" />
      </label>
      <div>
        <span className={label}>Správna odpoveď</span>
        <Segmented
          value={p.answer ? "t" : "f"}
          onChange={(v) => set({ answer: v === "t" })}
          options={[
            { value: "t", label: "Pravda" },
            { value: "f", label: "Nepravda" },
          ]}
        />
      </div>
      <label className="block">
        <span className={label}>Vysvetlenie</span>
        <Input value={p.explain ?? ""} onChange={(e) => set({ explain: e.target.value })} aria-label="Vysvetlenie" />
      </label>
    </div>
  );
}

function PairsEditor({ payload, onChange }: EditorProps) {
  const p = payload as PairsPayload;
  const set = (patch: Partial<PairsPayload>) => onChange({ ...p, ...patch });
  return (
    <div className="space-y-3">
      <label className="block">
        <span className={label}>Zadanie</span>
        <Input value={p.prompt ?? ""} onChange={(e) => set({ prompt: e.target.value })} aria-label="Zadanie" />
      </label>
      <div className="space-y-2">
        {p.pairs.map((pair, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={pair.left}
              aria-label={`Dvojica ${i + 1} vľavo`}
              onChange={(e) => set({ pairs: p.pairs.map((x, j) => (j === i ? { ...x, left: e.target.value } : x)) })}
            />
            <span className="text-mist font-black">–</span>
            <Input
              value={pair.right}
              aria-label={`Dvojica ${i + 1} vpravo`}
              onChange={(e) => set({ pairs: p.pairs.map((x, j) => (j === i ? { ...x, right: e.target.value } : x)) })}
            />
            {p.pairs.length > 3 && (
              <button
                type="button"
                aria-label={`Zmazať dvojicu ${i + 1}`}
                className={iconBtn}
                onClick={() => set({ pairs: p.pairs.filter((_, j) => j !== i) })}
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        ))}
      </div>
      {p.pairs.length < 6 && (
        <Button size="sm" variant="ghost" onClick={() => set({ pairs: [...p.pairs, { left: "", right: "" }] })}>
          <Plus className="size-4" /> Dvojica
        </Button>
      )}
    </div>
  );
}

function ClozeEditor({ payload, onChange }: EditorProps) {
  const p = payload as ClozePayload;
  const gaps = gapCount(p.text);
  const set = (patch: Partial<ClozePayload>) => onChange({ ...p, ...patch });
  const answers = Array.from({ length: Math.max(gaps, 0) }, (_, i) => p.answers[i] ?? "");
  const extra = p.options.filter((o) => !answers.includes(o));
  return (
    <div className="space-y-3">
      <label className="block">
        <span className={label}>Veta (medzeru napíš ako {GAP})</span>
        <Textarea
          rows={2}
          value={p.text}
          onChange={(e) => set({ text: e.target.value, answers: Array.from({ length: gapCount(e.target.value) }, (_, i) => p.answers[i] ?? "") })}
          aria-label="Veta"
        />
      </label>
      <div>
        <span className={label}>Správne slová do medzier</span>
        <div className="space-y-2">
          {answers.map((a, i) => (
            <Input
              key={i}
              value={a}
              aria-label={`Medzera ${i + 1}`}
              onChange={(e) => set({ answers: answers.map((x, j) => (j === i ? e.target.value : x)) })}
            />
          ))}
          {gaps === 0 && <p className="text-sm text-tomato font-semibold">Vo vete chýba medzera {GAP}.</p>}
        </div>
      </div>
      <label className="block">
        <span className={label}>Nesprávne slová do ponuky (oddelené čiarkou)</span>
        <Input
          value={extra.join(", ")}
          aria-label="Nesprávne slová"
          onChange={(e) =>
            set({
              options: [
                ...answers,
                ...e.target.value
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
              ],
            })
          }
        />
      </label>
      <label className="block">
        <span className={label}>Vysvetlenie</span>
        <Input value={p.explain ?? ""} onChange={(e) => set({ explain: e.target.value })} aria-label="Vysvetlenie" />
      </label>
    </div>
  );
}

function OrderEditor({ payload, onChange }: EditorProps) {
  const p = payload as OrderPayload;
  const set = (patch: Partial<OrderPayload>) => onChange({ ...p, ...patch });
  const move = (i: number, d: -1 | 1) => {
    const items = [...p.items];
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    set({ items });
  };
  return (
    <div className="space-y-3">
      <label className="block">
        <span className={label}>Zadanie</span>
        <Input value={p.prompt} onChange={(e) => set({ prompt: e.target.value })} aria-label="Zadanie" />
      </label>
      <div>
        <span className={label}>Položky v správnom poradí</span>
        <div className="space-y-2">
          {p.items.map((it, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="size-8 shrink-0 inline-flex items-center justify-center rounded-lg bg-paper font-black text-slate">{i + 1}</span>
              <Input value={it} aria-label={`Položka ${i + 1}`} onChange={(e) => set({ items: p.items.map((x, j) => (j === i ? e.target.value : x)) })} />
              <button
                type="button"
                aria-label={`Posunúť položku ${i + 1} vyššie`}
                disabled={i === 0}
                className={cx(iconBtn, "hover:text-ink hover:bg-ink/5 disabled:opacity-30")}
                onClick={() => move(i, -1)}
              >
                <ArrowUp className="size-4" />
              </button>
              <button
                type="button"
                aria-label={`Posunúť položku ${i + 1} nižšie`}
                disabled={i === p.items.length - 1}
                className={cx(iconBtn, "hover:text-ink hover:bg-ink/5 disabled:opacity-30")}
                onClick={() => move(i, 1)}
              >
                <ArrowDown className="size-4" />
              </button>
              {p.items.length > 3 && (
                <button
                  type="button"
                  aria-label={`Zmazať položku ${i + 1}`}
                  className={iconBtn}
                  onClick={() => set({ items: p.items.filter((_, j) => j !== i) })}
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        {p.items.length < 6 && (
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => set({ items: [...p.items, ""] })}>
            <Plus className="size-4" /> Položka
          </Button>
        )}
      </div>
    </div>
  );
}

const EDITORS: Record<ExerciseType, (p: EditorProps) => React.ReactElement> = {
  mcq: McqEditor,
  truefalse: TrueFalseEditor,
  pairs: PairsEditor,
  cloze: ClozeEditor,
  order: OrderEditor,
};

/** Formulár jedného cvičenia aj s kontrolou, či sa dá uložiť. */
export function ExerciseForm({
  type,
  payload,
  concept,
  onCancel,
  onSave,
}: {
  type: ExerciseType;
  payload: Payload;
  concept: string;
  onCancel: () => void;
  onSave: (p: Payload, concept: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Payload>(payload);
  const [topic, setTopic] = useState(concept);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const Editor = EDITORS[type];

  async function save() {
    const clean = cleanPayload(type, draft);
    if (!clean) return setError("Cvičenie ešte nie je úplné. Skontroluj, či je vyplnené všetko a či sú možnosti rôzne.");
    setBusy(true);
    setError(null);
    try {
      await onSave(clean, topic.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Uloženie zlyhalo.");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-paper border border-line p-3 space-y-3">
      <Editor payload={draft} onChange={setDraft} />
      <label className="block">
        <span className={label}>Téma</span>
        <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="napr. Veľká Morava" aria-label="Téma" />
      </label>
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex gap-2">
        <Button size="sm" onClick={save} loading={busy}>
          Uložiť
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Zrušiť
        </Button>
      </div>
    </div>
  );
}
