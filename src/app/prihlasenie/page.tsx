"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth";
import { Button, Card, ErrorNote, Field, Input, Segmented } from "@/components/ui";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const { session } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (session) router.replace("/");
  }, [session, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const sb = supabase();
    if (mode === "login") {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) setError(error.message === "Invalid login credentials" ? "Nesprávny e-mail alebo heslo." : error.message);
    } else {
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
      if (error) setError(error.message);
      else if (!data.session) setInfo("Poslali sme ti e-mail na potvrdenie. Po potvrdení sa tu prihlás.");
    }
    setBusy(false);
  }

  return (
    <main className="flex-1 flex items-center justify-center p-5">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex gap-1.5 mb-4" aria-hidden>
            {["u", "č", "í", "m", "e"].map((c, i) => (
              <span key={i} className={i === 1 ? "tile tile-filled" : i === 3 ? "tile tile-revealed" : "tile"}>
                {c}
              </span>
            ))}
          </div>
          <h1 className="text-3xl font-black">Tréning</h1>
          <p className="text-slate mt-1">Rodičovský účet pre celú rodinu</p>
          <p className="text-xs text-slate mt-2">Rovnaký účet ako v appkách Angličtina a Vybrané slová.</p>
        </div>
        <Card className="p-5">
          <Segmented
            className="w-full mb-5 [&>button]:flex-1"
            value={mode}
            onChange={setMode}
            options={[
              { value: "login", label: "Prihlásiť sa" },
              { value: "signup", label: "Nový účet" },
            ]}
          />
          <form onSubmit={submit} className="space-y-4">
            <Field label="E-mail">
              <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Heslo" hint={mode === "signup" ? "Aspoň 6 znakov." : undefined}>
              <Input
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {error && <ErrorNote>{error}</ErrorNote>}
            {info && <div className="rounded-xl bg-leaf-soft text-leaf px-3 py-2 text-sm font-semibold">{info}</div>}
            <Button type="submit" size="lg" className="w-full" loading={busy}>
              {mode === "login" ? "Prihlásiť sa" : "Vytvoriť účet"}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
