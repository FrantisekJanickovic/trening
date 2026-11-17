"use client";

import { Plus, Target, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button, ErrorNote, Input, cx } from "@/components/ui";
import { loadSets } from "@/lib/en/data";
import { supabase } from "@/lib/supabase";
import type { EnSet, SetItem } from "@/lib/en/types";

/**
 * Sady lekcie: rodič si z položiek poskladá kratší dril a dieťa ho dostane
 * ako samostatný tréning. Sada drží len zoznam položiek, nič nekopíruje.
 */
export default function SetsPanel({
  lessonId,
  picked,
  onClear,
  disabled,
}: {
  lessonId: string | null;
  picked: SetItem[];
  onClear: () => void;
  disabled?: boolean;
}) {
  const [sets, setSets] = useState<EnSet[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!lessonId) return setSets([]);
    setSets(await loadSets([lessonId]));
  }, [lessonId]);

  useEffect(() => {
    reload().catch(() => setSets([]));
  }, [reload]);

  async function create() {
    if (!lessonId || !name.trim() || !picked.length) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const { error } = await supabase().from("en_sets").insert({ lesson_id: lessonId, name: name.trim(), items: picked });
      if (error) throw new Error(error.message);
      setName("");
      onClear();
      await reload();
      setInfo("Sada je pripravená, dieťa ju uvidí pri výbere lekcií.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sadu sa nepodarilo vytvoriť.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(s: EnSet) {
    await supabase().from("en_sets").update({ active: !s.active }).eq("id", s.id);
    await reload();
  }

  async function remove(s: EnSet) {
    if (!window.confirm(`Zmazať sadu „${s.name}“? Položky lekcie zostanú.`)) return;
    await supabase().from("en_sets").delete().eq("id", s.id);
    await reload();
  }

  if (!lessonId) return null;

  return (
    <div className="space-y-3">
      {picked.length > 0 && (
        <div className="rounded-2xl border-2 border-sun-deep bg-sun-soft p-3 space-y-2">
          <p className="font-black">Nová sada z {picked.length} vybraných položiek</p>
          <p className="text-sm text-slate font-semibold">Dieťa ju dostane ako samostatný dril — hodí sa, keď sa skúša len časť lekcie.</p>
          <div className="flex flex-wrap gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="napr. Dril — slovesá pohybu"
              aria-label="Názov sady"
              className="flex-1 min-w-48"
            />
            <Button onClick={create} loading={busy} disabled={!name.trim() || disabled}>
              <Plus className="size-4" /> Vytvoriť sadu
            </Button>
            <Button variant="ghost" onClick={onClear}>
              Zrušiť výber
            </Button>
          </div>
        </div>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}
      {info && <p className="rounded-xl bg-leaf-soft text-leaf px-3 py-2 text-sm font-semibold">{info}</p>}

      {sets.length > 0 && (
        <div className="border-t border-line pt-3">
          <h3 className="font-black mb-2 inline-flex items-center gap-1.5">
            <Target className="size-4 text-sun-deep" /> Sady ({sets.length})
          </h3>
          <ul className="space-y-2">
            {sets.map((s) => (
              <li key={s.id} className={cx("flex flex-wrap items-center gap-2 rounded-2xl border p-2.5", s.active ? "border-leaf bg-leaf-soft/40" : "border-line")}>
                <span className="font-black">{s.name}</span>
                <span className="text-sm text-slate font-semibold">{s.items.length} položiek</span>
                <label className="ml-auto inline-flex items-center gap-1.5 text-sm font-bold cursor-pointer">
                  <input type="checkbox" checked={s.active} onChange={() => toggle(s)} className="size-4 accent-[#1f9d63]" />
                  Aktívna
                </label>
                <button
                  type="button"
                  aria-label={`Zmazať sadu ${s.name}`}
                  onClick={() => remove(s)}
                  className="size-8 inline-flex items-center justify-center rounded-lg text-mist hover:text-tomato hover:bg-tomato-soft"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
