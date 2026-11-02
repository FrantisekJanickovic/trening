"use client";

import { ArrowLeft, Smartphone } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Card, ErrorNote, Field, Input, Spinner, Toggle, cx } from "@/components/ui";
import { getChild } from "@/lib/data";
import { getLockedChild, setLockedChild } from "@/lib/device";
import { supabase } from "@/lib/supabase";

const AVATARS = ["🦊", "🐼", "🐯", "🦁", "🐸", "🐙", "🦄", "🐧", "🐨", "🦖", "🐬", "🦉"];

export default function ChildEditor() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const [loaded, setLoaded] = useState(!id);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [grade, setGrade] = useState(3);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getChild(id).then((c) => {
      if (c) {
        setName(c.name);
        setAvatar(c.avatar);
        setGrade(c.grade);
      }
      setLocked(getLockedChild() === id);
      setLoaded(true);
    });
  }, [id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Napíš meno.");
    setBusy(true);
    setError(null);
    const sb = supabase();
    const row = { name: name.trim(), avatar, grade };
    const res = id ? await sb.from("children").update(row).eq("id", id).select("id").single() : await sb.from("children").insert(row).select("id").single();
    setBusy(false);
    if (res.error) return setError(res.error.message);
    if (locked) setLockedChild(res.data.id);
    else if (getLockedChild() === res.data.id) setLockedChild(null);
    router.push("/rodic");
  }

  if (!loaded) return <Spinner />;

  return (
    <form onSubmit={save} className="space-y-5 max-w-xl">
      <Link href="/rodic" className="inline-flex items-center gap-1 text-sm font-bold text-slate">
        <ArrowLeft className="size-4" /> Prehľad
      </Link>
      <h1 className="text-2xl font-black">{id ? "Upraviť dieťa" : "Nové dieťa"}</h1>
      <Card className="p-5 space-y-4">
        <Field label="Meno">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} />
        </Field>
        <div>
          <span className="block text-sm font-bold text-ink-soft mb-1.5">Obrázok</span>
          <div className="flex flex-wrap gap-2">
            {AVATARS.map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={avatar === a}
                aria-label={`Obrázok ${a}`}
                onClick={() => setAvatar(a)}
                className={cx("size-12 text-2xl rounded-2xl border-2", avatar === a ? "bg-sun-soft border-sun-deep" : "bg-card border-line")}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        <Field label="Trieda">
          <select
            value={grade}
            onChange={(e) => setGrade(Number(e.target.value))}
            className="w-full h-11 rounded-xl border-2 border-line bg-card px-3 font-semibold"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => (
              <option key={g} value={g}>
                {g}. trieda
              </option>
            ))}
          </select>
        </Field>
        <p className="text-xs text-slate">Profil je spoločný s appkami Angličtina a Vybrané slová.</p>
      </Card>
      <Card className="p-5">
        <Toggle
          checked={locked}
          onChange={setLocked}
          label={
            <span className="inline-flex items-center gap-2">
              <Smartphone className="size-4" /> Zamknúť toto zariadenie na toto dieťa
            </span>
          }
          description="Na mobile dieťaťa sa appka otvorí rovno na výbere predmetu."
        />
      </Card>
      {error && <ErrorNote>{error}</ErrorNote>}
      <Button type="submit" size="lg" loading={busy}>
        Uložiť
      </Button>
    </form>
  );
}
