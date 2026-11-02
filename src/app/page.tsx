"use client";

import { Lock, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/auth";
import { Spinner, buttonClass } from "@/components/ui";
import { listChildren } from "@/lib/data";
import { getLockedChild } from "@/lib/device";
import type { Child } from "@/lib/types";

function ProfilePicker() {
  const router = useRouter();
  const [children, setChildren] = useState<Child[] | null>(null);

  useEffect(() => {
    const locked = getLockedChild();
    if (locked) {
      router.replace(`/predmet?child=${locked}`);
      return;
    }
    listChildren()
      .then(setChildren)
      .catch(() => setChildren([]));
  }, [router]);

  if (!children) return <Spinner />;

  return (
    <main className="flex-1 flex flex-col p-5 max-w-xl w-full mx-auto">
      <header className="flex items-center justify-between pt-2">
        <span className="font-black text-lg">Tréning</span>
        <Link href="/rodic" className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl text-sm font-bold text-slate hover:bg-ink/5">
          <Lock className="size-4" /> Rodič
        </Link>
      </header>

      <div className="flex-1 flex flex-col justify-center py-10">
        {children.length === 0 ? (
          <div className="text-center">
            <h1 className="text-2xl font-black">Vitaj!</h1>
            <p className="text-slate mt-2 mb-6">Najprv vytvor profil dieťaťa a prvú lekciu.</p>
            <Link href="/rodic" className={buttonClass("primary", "lg")}>
              <Settings className="size-5" /> Rodičovská zóna
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-black text-center mb-8">Kto ide trénovať?</h1>
            <div className="grid grid-cols-2 gap-4">
              {children.map((c) => (
                <Link
                  key={c.id}
                  href={`/predmet?child=${c.id}`}
                  className="group rounded-3xl bg-card border-2 border-line border-b-[6px] p-5 flex flex-col items-center gap-2 hover:border-sun-deep active:translate-y-[2px] active:border-b-4 transition"
                >
                  <span className="text-6xl leading-none group-hover:scale-110 transition-transform">{c.avatar}</span>
                  <span className="text-xl font-black">{c.name}</span>
                  <span className="text-sm text-slate font-semibold">{c.grade}. trieda</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <RequireAuth>
      <ProfilePicker />
    </RequireAuth>
  );
}
