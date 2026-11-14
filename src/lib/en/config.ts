"use client";

import { supabase } from "@/lib/supabase";
import type { GlobalConfig } from "./types";

export const DEFAULT_CONFIG: GlobalConfig = {
  reviewPrevious: true,
  previousLessons: 2,
  previousMax: 6,
  masteryStreak: 3,
  maxSavedPerSession: 10,
};

export const LIMITS = {
  previousLessons: [1, 10],
  previousMax: [1, 20],
  masteryStreak: [1, 10],
  maxSavedPerSession: [1, 30],
} as const;

const clamp = (v: unknown, [lo, hi]: readonly [number, number], fallback: number) => {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.min(hi, Math.max(lo, n));
};

export function mergeConfig(c: Partial<GlobalConfig> | null | undefined): GlobalConfig {
  const d = DEFAULT_CONFIG;
  return {
    reviewPrevious: typeof c?.reviewPrevious === "boolean" ? c.reviewPrevious : d.reviewPrevious,
    previousLessons: clamp(c?.previousLessons, LIMITS.previousLessons, d.previousLessons),
    previousMax: clamp(c?.previousMax, LIMITS.previousMax, d.previousMax),
    masteryStreak: clamp(c?.masteryStreak, LIMITS.masteryStreak, d.masteryStreak),
    maxSavedPerSession: clamp(c?.maxSavedPerSession, LIMITS.maxSavedPerSession, d.maxSavedPerSession),
  };
}

export async function loadConfig(): Promise<GlobalConfig> {
  const { data } = await supabase().from("parent_settings").select("config").maybeSingle();
  return mergeConfig((data?.config as Partial<GlobalConfig> | undefined) ?? null);
}

export async function saveConfig(config: GlobalConfig) {
  const sb = supabase();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) throw new Error("Nie si prihlásený.");
  const { error } = await sb.from("parent_settings").upsert({ owner_id: u.user.id, config: mergeConfig(config) });
  if (error) throw error;
}
