"use client";

import { authHeader } from "@/lib/supabase";
import type { Lang } from "./types";

/**
 * Voice output.
 * 1) If the server has Azure Speech configured, audio comes from /api/tts (real male/female EN + SK voices)
 *    and is prefetched at session start, so playback during practice is instant.
 * 2) Otherwise the phone's built-in voice (speechSynthesis) is used.
 */

export type VoiceOpts = { gender: "female" | "male"; slow?: boolean };

let azureAvailable: boolean | null = null;
let azureProbe: Promise<boolean> | null = null;
const audioCache = new Map<string, string>(); // key -> object URL
const pending = new Map<string, Promise<string | null>>();
let audioEl: HTMLAudioElement | null = null;
let currentStop: (() => void) | null = null;

const key = (text: string, lang: Lang, o: VoiceOpts) => `${lang}|${o.gender}|${o.slow ? 1 : 0}|${text}`;

export async function hasAzure(): Promise<boolean> {
  if (azureAvailable !== null) return azureAvailable;
  if (!azureProbe) {
    azureProbe = fetch("/api/tts", { headers: await authHeader() })
      .then((r) => r.json())
      .then((j) => (azureAvailable = !!j.azure))
      .catch(() => (azureAvailable = false));
  }
  return azureProbe;
}

async function fetchAzure(text: string, lang: Lang, o: VoiceOpts): Promise<string | null> {
  const k = key(text, lang, o);
  const cached = audioCache.get(k);
  if (cached) return cached;
  const inflight = pending.get(k);
  if (inflight) return inflight;
  const p = (async () => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ text, lang, gender: o.gender, slow: !!o.slow }),
      });
      if (!res.ok) return null;
      const url = URL.createObjectURL(await res.blob());
      audioCache.set(k, url);
      return url;
    } catch {
      return null;
    } finally {
      pending.delete(k);
    }
  })();
  pending.set(k, p);
  return p;
}

/** Prefetch everything a session will say, a few requests at a time. */
export async function prefetch(items: { text: string; lang: Lang }[], o: VoiceOpts, onProgress?: (done: number, total: number) => void) {
  if (!(await hasAzure())) return;
  const queue = items.filter((i) => i.text?.trim());
  let done = 0;
  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const it = queue.shift()!;
      await fetchAzure(it.text, it.lang, o);
      done++;
      onProgress?.(done, items.length);
    }
  });
  await Promise.all(workers);
}

function silentWav(): string {
  const n = 400;
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const w = (o: number, t: string) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  v.setUint32(4, 36 + n, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true);
  v.setUint32(28, 8000, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  w(36, "data");
  v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

/** Must be called from a tap on iOS before the first sound. */
export function unlockAudio() {
  if (typeof window === "undefined") return;
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.setAttribute("playsinline", "true");
  }
  audioEl.muted = true;
  audioEl.src = silentWav();
  audioEl
    .play()
    .catch(() => {})
    .finally(() => {
      if (audioEl) audioEl.muted = false;
    });
  try {
    window.speechSynthesis?.resume();
  } catch {}
}

export function stopSpeaking() {
  currentStop?.();
  currentStop = null;
  try {
    window.speechSynthesis?.cancel();
  } catch {}
  if (audioEl) {
    audioEl.pause();
  }
}

function playUrl(url: string): Promise<void> {
  return new Promise((resolve) => {
    if (!audioEl) {
      audioEl = new Audio();
      audioEl.setAttribute("playsinline", "true");
    }
    const el = audioEl;
    const done = () => {
      el.onended = null;
      el.onerror = null;
      resolve();
    };
    currentStop = done;
    el.onended = done;
    el.onerror = done;
    el.src = url;
    el.muted = false;
    el.play().catch(done);
  });
}

const FEMALE =
  /(female|samantha|karen|serena|kate|martha|moira|tessa|fiona|victoria|zuzana|laura|libby|sonia|jenny|aria|susan|hazel|google uk english female|amy|emma|olivia)/i;
const MALE = /(male|daniel|arthur|oliver|alex|fred|ryan|thomas|lukas|guy|george|james|google uk english male|brian|aaron|rishi)/i;

function pickVoice(lang: Lang, gender: "female" | "male"): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const prefixes = lang === "en" ? ["en-GB", "en-US", "en"] : ["sk-SK", "sk", "cs-CZ"];
  for (const p of prefixes) {
    const pool = voices.filter((v) => v.lang.replace("_", "-").toLowerCase().startsWith(p.toLowerCase()));
    if (!pool.length) continue;
    const re = gender === "female" ? FEMALE : MALE;
    const other = gender === "female" ? MALE : FEMALE;
    return (
      pool.find((v) => re.test(v.name) && !(gender === "female" && /\bmale\b/i.test(v.name) && !/female/i.test(v.name))) ??
      pool.find((v) => !other.test(v.name)) ??
      pool[0]
    );
  }
  return undefined;
}

function speakBrowser(text: string, lang: Lang, o: VoiceOpts): Promise<void> {
  return new Promise((resolve) => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(lang, o.gender);
    if (v) u.voice = v;
    u.lang = v?.lang ?? (lang === "en" ? "en-GB" : "sk-SK");
    u.rate = o.slow ? 0.75 : 0.95;
    u.pitch = o.gender === "male" && !v ? 0.85 : 1;
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      resolve();
    };
    currentStop = done;
    u.onend = done;
    u.onerror = done;
    synth.speak(u);
    // Safety net: some browsers never fire onend.
    setTimeout(done, 1500 + text.length * 120);
  });
}

let priorityPlayback: Promise<void> | null = null;

async function speakNow(text: string, lang: Lang, o: VoiceOpts): Promise<void> {
  stopSpeaking();
  if (await hasAzure()) {
    const url = await fetchAzure(text, lang, o);
    if (url) return playUrl(url);
  }
  return speakBrowser(text, lang, o);
}

/**
 * Speak a text. A normal call interrupts whatever is playing, except a priority message
 * (greeting, motivation), which is allowed to finish first.
 */
export async function speak(text: string, lang: Lang, o: VoiceOpts & { priority?: boolean }): Promise<void> {
  if (!text?.trim()) return;
  if (o.priority) {
    const p = speakNow(text, lang, o).finally(() => {
      if (priorityPlayback === p) priorityPlayback = null;
    });
    priorityPlayback = p;
    return p;
  }
  if (priorityPlayback) await priorityPlayback;
  return speakNow(text, lang, o);
}

export async function speakSequence(parts: { text: string; lang: Lang }[], o: VoiceOpts, gapMs = 350) {
  for (const p of parts) {
    await speak(p.text, p.lang, o);
    await new Promise((r) => setTimeout(r, gapMs));
  }
}

// ---------- speech recognition (oral answers) ----------

type SR = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function SRCtor(): (new () => SR) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function canRecognize() {
  return !!SRCtor();
}

export type Listening = { stop: () => void; result: Promise<string[]> };

/** Listen once; resolves with recognition alternatives (best first). */
export function listen(lang: Lang): Listening {
  const Ctor = SRCtor();
  if (!Ctor) return { stop: () => {}, result: Promise.reject(new Error("unsupported")) };
  const rec = new Ctor();
  rec.lang = lang === "en" ? "en-GB" : "sk-SK";
  rec.interimResults = false;
  rec.maxAlternatives = 5;
  rec.continuous = false;
  const result = new Promise<string[]>((resolve, reject) => {
    let got: string[] = [];
    rec.onresult = (e) => {
      const r = e.results[0];
      got = Array.from({ length: r.length }, (_, i) => r[i].transcript);
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") resolve([]);
      else reject(new Error(e.error));
    };
    rec.onend = () => resolve(got);
  });
  stopSpeaking();
  rec.start();
  return { stop: () => rec.stop(), result };
}
