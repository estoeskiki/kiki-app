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

  const d = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * W;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
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
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
