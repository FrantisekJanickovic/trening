/** Small line chart of scores (0–100 %) over time, oldest on the left. */
export function ScoreChart({ scores, label }: { scores: number[]; label: string }) {
  const w = 280;
  const h = 90;
  const pad = 8;
  if (scores.length === 0) return null;
  const x = (i: number) => (scores.length === 1 ? w / 2 : pad + (i * (w - 2 * pad)) / (scores.length - 1));
  const y = (s: number) => h - pad - (s / 100) * (h - 2 * pad);
  const points = scores.map((s, i) => `${x(i)},${y(s)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-24" role="img" aria-label={label}>
      {[0, 50, 100].map((g) => (
        <line key={g} x1={pad} x2={w - pad} y1={y(g)} y2={y(g)} stroke="var(--color-line)" strokeDasharray={g === 50 ? "4 4" : undefined} />
      ))}
      {scores.length > 1 && <polyline points={points} fill="none" stroke="var(--color-sky)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />}
      {scores.map((s, i) => (
        <circle
          key={i}
          cx={x(i)}
          cy={y(s)}
          r={i === scores.length - 1 ? 5.5 : 3.5}
          fill={s >= 90 ? "var(--color-leaf)" : s >= 60 ? "var(--color-sky)" : "var(--color-tomato)"}
        />
      ))}
    </svg>
  );
}
