"use client";

import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { Card, Spinner, cx } from "@/components/ui";
import { subjectDef } from "@/data/subjects";
import { loadNotifications, markNotificationsRead } from "@/lib/data";
import type { Notification } from "@/lib/types";

const when = (iso: string) => new Date(iso).toLocaleString("sk-SK", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });

export default function Messages() {
  const [rows, setRows] = useState<Notification[] | null>(null);

  useEffect(() => {
    loadNotifications().then((n) => {
      setRows(n);
      const unread = n.filter((x) => !x.read_at).map((x) => x.id);
      if (unread.length) void markNotificationsRead(unread);
    });
  }, []);

  if (!rows) return <Spinner />;

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-black">Správy</h1>
      <p className="text-slate">Čo deti odtrénovali. Správy sa zapínajú v nastaveniach každého predmetu.</p>
      {rows.length === 0 ? (
        <Card className="p-6 text-center text-slate">Zatiaľ žiadne správy.</Card>
      ) : (
        <ul className="space-y-2">
          {rows.map((n) => (
            <li key={n.id}>
              <Card className={cx("p-4 flex items-start gap-3", !n.read_at && "border-2 border-sky")}>
                <span className="text-2xl">{subjectDef(n.subject)?.icon ?? "📘"}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-black">{n.title}</p>
                  <p className="text-sm text-slate break-words">{n.body}</p>
                  <p className="text-xs text-mist font-semibold mt-0.5">{when(n.created_at)}</p>
                </div>
                {n.kind === "low_score" && (
                  <span className="shrink-0 rounded-md bg-tomato-soft text-tomato px-1.5 py-0.5 text-xs font-black">slabý výsledok</span>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-slate inline-flex items-center gap-1">
        <Bell className="size-3.5" /> E-mail a push doplníme neskôr, zatiaľ sú správy len tu.
      </p>
    </div>
  );
}
