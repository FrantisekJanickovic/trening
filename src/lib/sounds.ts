"use client";

/** Short, quiet tones for right and wrong answers. No files, no network: generated in the browser. */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** One soft note with a gentle attack and release, so it never clicks. */
function note(c: AudioContext, freq: number, start: number, len: number, gain: number, type: OscillatorType = "sine") {
  const osc = c.createOscillator();
  const vol = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  vol.gain.setValueAtTime(0.0001, start);
  vol.gain.exponentialRampToValueAtTime(gain, start + 0.02);
  vol.gain.exponentialRampToValueAtTime(0.0001, start + len);
  osc.connect(vol).connect(c.destination);
  osc.start(start);
  osc.stop(start + len + 0.02);
}

/** Right: two rising notes. Wrong: one low, short note. Both are quiet on purpose. */
export function playAnswer(correct: boolean) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + 0.01;
  if (correct) {
    note(c, 784, t, 0.12, 0.05);
    note(c, 1046, t + 0.1, 0.16, 0.045);
  } else {
    note(c, 233, t, 0.2, 0.05, "triangle");
  }
}
