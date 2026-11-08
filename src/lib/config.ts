"use client";

import type { SubjectSlug } from "@/data/subjects";
import { ASPECT_KEYS, TYPES, type Aspect, type ExerciseType } from "./exercises";
import { supabase } from "./supabase";
import type { SubjectConfig } from "./types";

const allTypes = (on: boolean) => Object.fromEntries(TYPES.map((t) => [t.key, on])) as Record<ExerciseType, boolean>;
const allAspects = (on: boolean) => Object.fromEntries(ASPECT_KEYS.map((k) => [k, on])) as Record<Aspect, boolean>;

export const DEFAULT_CONFIG: SubjectConfig = {
  enabled: false,
  types: allTypes(true),
  aspects: allAspects(true),
  generateCount: 20,
  masteryStreak: 3,
  encouragement: true,
  sounds: true,
  allowExit: true,
  notifyOnFinish: true,
  lowScore: 60,
};

export const LIMITS = { generateCount: [5, 60], masteryStreak: [1, 10], lowScore: [0, 100] } as const;

const clamp = (v: unknown, [lo, hi]: readonly [number, number], d: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d;
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);

export function mergeConfig(raw: unknown): SubjectConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<SubjectConfig>;
  const types = (r.types ?? {}) as Record<string, unknown>;
  const aspects = (r.aspects ?? {}) as Record<string, unknown>;
  return {
    enabled: bool(r.enabled, DEFAULT_CONFIG.enabled),
    types: Object.fromEntries(TYPES.map((t) => [t.key, bool(types[t.key], true)])) as Record<ExerciseType, boolean>,
    aspects: Object.fromEntries(ASPECT_KEYS.map((k) => [k, bool(aspects[k], true)])) as Record<Aspect, boolean>,
    generateCount: clamp(r.generateCount, LIMITS.generateCount, DEFAULT_CONFIG.generateCount),
    masteryStreak: clamp(r.masteryStreak, LIMITS.masteryStreak, DEFAULT_CONFIG.masteryStreak),
    encouragement: bool(r.encouragement, true),
    sounds: bool(r.sounds, true),
    allowExit: bool(r.allowExit, true),
    notifyOnFinish: bool(r.notifyOnFinish, true),
    lowScore: clamp(r.lowScore, LIMITS.lowScore, DEFAULT_CONFIG.lowScore),
  };
}

/** Nastavenia všetkých predmetov naraz; predmet bez riadku má predvolené hodnoty. */
export async function loadConfigs(): Promise<Record<string, SubjectConfig>> {
  const { data } = await supabase().from("tr_settings").select("subject, config");
  const out: Record<string, SubjectConfig> = {};
  for (const r of (data ?? []) as { subject: string; config: unknown }[]) out[r.subject] = mergeConfig(r.config);
  return out;
}

export async function loadConfig(subject: SubjectSlug): Promise<SubjectConfig> {
  const { data } = await supabase().from("tr_settings").select("config").eq("subject", subject).maybeSingle();
  return mergeConfig(data?.config);
}

export async function saveConfig(subject: SubjectSlug, config: SubjectConfig) {
  const sb = supabase();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) throw new Error("Nie si prihlásený.");
  const { error } = await sb
    .from("tr_settings")
    .upsert({ owner_id: u.user.id, subject, config, updated_at: new Date().toISOString() }, { onConflict: "owner_id,subject" });
  if (error) throw error;
}
