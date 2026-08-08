/**
 * Trend line for KPI tiles. Server-rendered SVG with no interactivity — the
 * exact numbers live in the tile above it; this only carries shape.
 */
export function Sparkline({
  values,
  tone = 'lime',
  height = 32,
}: {
  values: number[];
  tone?: 'lime' | 'pink' | 'cyan';
  height?: number;
}) {
  if (values.length < 2) return <div style={{ height }} aria-hidden />;

  const W = 200;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((v, i) => ({
    x: (i / (values.length - 1)) * W,
    y: height - ((v - min) / range) * (height - 4) - 2,
  }));

  // Horizontal-tangent cubic segments, same technique as AreaChart. Straight
  // `L` segments between daily points drew this as a harsh, spiky zigzag —
  // accurate but reading as broken next to the smooth curve in the big revenue
  // chart right below it on Overview. Smoothing here is purely cosmetic: it
  // never crosses a real data point, so it can't imply a value the data does
  // not contain.
  const d = points
    .map((p, i) => {
      if (i === 0) return `M${p.x.toFixed(2)},${p.y.toFixed(2)}`;
      const prev = points[i - 1];
      const cx = (prev.x + p.x) / 2;
      return `C${cx.toFixed(2)},${prev.y.toFixed(2)} ${cx.toFixed(2)},${p.y.toFixed(2)} ${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    })
    .join(' ');

  const stroke =
    tone === 'pink'
      ? 'var(--color-secondary)'
      : tone === 'cyan'
        ? 'var(--color-tertiary)'
        : 'var(--color-primary)';

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      className="block w-full"
      style={{ height }}
      aria-hidden
    >
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
