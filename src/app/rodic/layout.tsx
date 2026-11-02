"use client";

import { Bell, ChartNoAxesColumn, House, Play, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { RequireAuth } from "@/components/auth";
import { Button, Card, cx, ErrorNote, Input, Spinner } from "@/components/ui";
import { getPinHash, isParentUnlocked, setParentUnlocked, verifyPin } from "@/lib/device";

const NAV = [
  { href: "/rodic", label: "Prehľad", icon: House },
  { href: "/rodic/spravy", label: "Správy", icon: Bell },
  { href: "/rodic/historia", label: "História", icon: ChartNoAxesColumn },
  { href: "/rodic/nastavenia", label: "Nastavenia", icon: Settings },
];

function isActive(pathname: string, href: string) {
  if (href === "/rodic")
    return pathname === "/rodic" || pathname.startsWith("/rodic/dieta") || /^\/rodic\/[a-z]+$/.test(pathname) || pathname.startsWith("/rodic/lekcia");
  return pathname.startsWith(href);
}

function PinGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"checking" | "locked" | "open">("checking");
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (isParentUnlocked()) {
      setState("open");
      return;
    }
    getPinHash()
      .then((h) => setState(h ? "locked" : "open"))
      .catch(() => setState("open"));
  }, []);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    if (await verifyPin(pin)) {
      setParentUnlocked(true);
      setState("open");
    } else {
      setError(true);
      setPin("");
    }
  }

  if (state === "checking") return <Spinner />;
  if (state === "locked")
    return (
      <main className="flex-1 flex items-center justify-center p-5">
        <Card className="p-6 w-full max-w-xs text-center">
          <h1 className="text-xl font-black mb-1">Rodičovská zóna</h1>
          <p className="text-slate text-sm mb-4">Zadaj PIN</p>
          <form onSubmit={check} className="space-y-3">
            <Input
              autoFocus
              inputMode="numeric"
              type="password"
              maxLength={6}
              className="text-center text-2xl tracking-[0.5em] h-14"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, ""));
                setError(false);
              }}
            />
            {error && <ErrorNote>Nesprávny PIN</ErrorNote>}
            <Button type="submit" className="w-full">
              Odomknúť
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => router.push("/")}>
              Späť
            </Button>
          </form>
        </Card>
      </main>
    );
  return <>{children}</>;
}

/** Odkazy v hlavičke a dole; adresu čítajú zvlášť, aby sa stránka dala vopred vykresliť. */
function DesktopNav() {
  const pathname = usePathname();
  return (
    <nav className="hidden md:flex gap-1">
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          className={cx(
            "h-10 px-3 rounded-xl inline-flex items-center gap-2 font-bold text-sm",
            isActive(pathname, n.href) ? "bg-card border border-line text-ink" : "text-slate hover:text-ink",
          )}
        >
          <n.icon className="size-4" /> {n.label}
        </Link>
      ))}
    </nav>
  );
}

function MobileNav() {
  const pathname = usePathname();
  return (
    <div className="grid grid-cols-4">
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          className={cx("flex flex-col items-center gap-0.5 text-xs font-bold py-1", isActive(pathname, n.href) ? "text-ink" : "text-mist")}
        >
          <n.icon className="size-5" />
          {n.label}
        </Link>
      ))}
    </div>
  );
}

export default function ParentLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  return (
    <RequireAuth>
      <PinGate>
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-20 bg-paper/90 backdrop-blur border-b border-line">
            <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-2">
              <Link href="/rodic" className="font-black text-lg mr-4">
                Tréning <span className="text-slate font-bold text-sm">· rodič</span>
              </Link>
              <Suspense fallback={null}>
                <DesktopNav />
              </Suspense>
              <div className="ml-auto flex gap-1">
                <Button
                  variant="sun"
                  size="sm"
                  onClick={() => {
                    setParentUnlocked(false);
                    router.push("/");
                  }}
                >
                  <Play className="size-4" /> Na tréning
                </Button>
              </div>
            </div>
          </header>
          <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6 pb-28 md:pb-10">{children}</main>
          <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-card border-t border-line safe-bottom pt-2">
            <Suspense fallback={null}>
              <MobileNav />
            </Suspense>
          </nav>
        </div>
      </PinGate>
    </RequireAuth>
  );
}
