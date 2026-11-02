"use client";

import { supabase } from "./supabase";

const LOCK_KEY = "trening.lockedChild";
const UNLOCK_KEY = "trening.parentUnlocked";

const safe = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

export const getLockedChild = () => safe(() => localStorage.getItem(LOCK_KEY), null);
export const setLockedChild = (id: string | null) => safe(() => (id ? localStorage.setItem(LOCK_KEY, id) : localStorage.removeItem(LOCK_KEY)), undefined);

export const isParentUnlocked = () => safe(() => sessionStorage.getItem(UNLOCK_KEY) === "1", false);
export const setParentUnlocked = (v: boolean) => safe(() => (v ? sessionStorage.setItem(UNLOCK_KEY, "1") : sessionStorage.removeItem(UNLOCK_KEY)), undefined);

export async function hashPin(pin: string, userId: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${userId}:${pin}`));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getPinHash(): Promise<string | null> {
  const { data } = await supabase().from("parent_settings").select("pin_hash").maybeSingle();
  return (data?.pin_hash as string | null) ?? null;
}

export async function savePin(pin: string | null) {
  const sb = supabase();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) throw new Error("Nie si prihlásený.");
  const pin_hash = pin ? await hashPin(pin, u.user.id) : null;
  const { error } = await sb.from("parent_settings").upsert({ owner_id: u.user.id, pin_hash });
  if (error) throw error;
}

export async function verifyPin(pin: string) {
  const sb = supabase();
  const { data: u } = await sb.auth.getUser();
  const stored = await getPinHash();
  if (!stored || !u.user) return true;
  return (await hashPin(pin, u.user.id)) === stored;
}
