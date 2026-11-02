"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth";
import { Button, Card, ErrorNote, Field, Input } from "@/components/ui";
import { getLockedChild, getPinHash, savePin, setLockedChild, setParentUnlocked } from "@/lib/device";
import { aiInfo } from "@/lib/ai";
import { supabase } from "@/lib/supabase";

export default function SettingsPage() {
  const { session } = useAuth();
  const router = useRouter();
  const [hasPin, setHasPin] = useState(false);
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState<string | null>(null);
  const [ai, setAi] = useState<{ ai: boolean; model: string | null } | null>(null);

  useEffect(() => {
    getPinHash().then((h) => setHasPin(!!h));
    setLocked(getLockedChild());
    aiInfo().then(setAi);
  }, []);

  async function onSavePin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{4,6}$/.test(pin)) {
      setError("PIN musí mať 4 až 6 číslic.");
      return;
    }
    await savePin(pin);
    setHasPin(true);
    setPin("");
    setMsg("PIN je nastavený. Rodičovská zóna ho bude pýtať.");
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <h1 className="text-2xl font-black">Nastavenia</h1>

      <Card className="p-5 sm:p-6 space-y-4">
        <h2 className="text-lg font-black">PIN rodičovskej zóny</h2>
        <p className="text-sm text-slate -mt-2">Deti sa bez PIN-u nedostanú k lekciám, nastaveniam ani histórii. PIN je spoločný pre všetky rodinné appky.</p>
        <form onSubmit={onSavePin} className="flex flex-wrap gap-2 items-end">
          <Field label={hasPin ? "Nový PIN" : "PIN"}>
            <Input
              inputMode="numeric"
              type="password"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              className="w-40 tracking-[0.3em]"
            />
          </Field>
          <Button type="submit">{hasPin ? "Zmeniť PIN" : "Nastaviť PIN"}</Button>
          {hasPin && (
            <Button
              type="button"
              variant="ghost"
              onClick={async () => {
                await savePin(null);
                setHasPin(false);
                setMsg("PIN je zrušený.");
              }}
            >
              Zrušiť PIN
            </Button>
          )}
        </form>
        {error && <ErrorNote>{error}</ErrorNote>}
        {msg && <p className="text-sm font-bold text-leaf">{msg}</p>}
      </Card>

      <Card className="p-5 sm:p-6 space-y-3">
        <h2 className="text-lg font-black">Toto zariadenie</h2>
        {locked ? (
          <>
            <p className="text-sm text-slate">Zariadenie je zamknuté na jeden profil dieťaťa.</p>
            <Button
              variant="outline"
              onClick={() => {
                setLockedChild(null);
                setLocked(null);
              }}
            >
              Odomknúť zariadenie
            </Button>
          </>
        ) : (
          <p className="text-sm text-slate">Zariadenie ukazuje výber všetkých detí. Zamknúť ho na jedno dieťa môžeš v profile dieťaťa.</p>
        )}
      </Card>

      <Card className="p-5 sm:p-6 space-y-2">
        <h2 className="text-lg font-black">Služby</h2>
        <p className="text-sm">
          <b>AI (prepis fotiek a generovanie cvičení):</b>{" "}
          {!ai ? "overujem…" : ai.ai ? `zapnuté (OpenAI, model ${ai.model})` : "vypnuté, vo Verceli chýba kľúč OPENAI_API_KEY"}
        </p>
      </Card>

      <Card className="p-5 sm:p-6 space-y-3">
        <h2 className="text-lg font-black">Účet</h2>
        <p className="text-sm text-slate">Prihlásený ako {session?.user.email}</p>
        <Button
          variant="outline"
          onClick={async () => {
            setParentUnlocked(false);
            setLockedChild(null);
            await supabase().auth.signOut();
            router.replace("/prihlasenie");
          }}
        >
          <LogOut className="size-4" /> Odhlásiť sa
        </Button>
      </Card>
    </div>
  );
}
