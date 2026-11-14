"use client";

import { CircleHelp, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";

/**
 * Otáznik pri cvičení. Dieťa si ním kedykoľvek pripomenie, čo má robiť,
 * bez toho, aby muselo zavolať rodiča alebo tréning opustiť.
 */
export default function HelpButton({ title, what, how }: { title: string; what: string; how?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Čo mám robiť?"
        onClick={() => setOpen(true)}
        className="size-9 shrink-0 inline-flex items-center justify-center rounded-xl text-sky hover:bg-sky-soft"
      >
        <CircleHelp className="size-5" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Čo mám robiť: ${title}`}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
          <Card className="p-5 space-y-3 anim-rise">
            <div className="flex items-start gap-2">
              <h2 className="text-xl font-black flex-1">{title}</h2>
              <button type="button" aria-label="Zavrieť" onClick={() => setOpen(false)} className="size-8 inline-flex items-center justify-center rounded-lg text-slate hover:bg-ink/5">
                <X className="size-5" />
              </button>
            </div>
            <p className="text-base font-semibold leading-snug">{what}</p>
            {how && <p className="text-base text-slate leading-snug">{how}</p>}
            <Button size="lg" variant="sun" onClick={() => setOpen(false)}>
              Rozumiem
            </Button>
          </Card>
          </div>
        </div>
      )}
    </>
  );
}
