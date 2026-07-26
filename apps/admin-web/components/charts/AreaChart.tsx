'use client';

import { useId, useState } from 'react';

export type AreaPoint = { label: string; value: number; formatted: string };

/**
 * Smoothed area chart with a hover crosshair, ported from the design reference.
 *
 * Hand-rolled SVG rather than a charting library: this is the only chart in the
 * app that needs interaction, and pulling in Recharts would cost more JS than
 * the entire rest of the dashboard ships.
 *
 * Hover targets are invisible full-height rects, so the pointer never has to
 * find a 2px line.
 */
export function AreaChart({
  data,
  tone = 'lime',
  height = 190,
}: {
  data: AreaPoint[];
  tone?: 'lime' | 'cyan';
  height?: number;
}) {
  const gradientId = useId();
  const [active, setActive] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-[12px] text-muted"
        style={{ height }}
      >
        Sin datos en este período
      </div>
    );
  }

  const color = tone === 'cyan' ? 'var(--color-tertiary)' : 'var(--color-primary)';
  const W = 800;
  const padX = 4;
  const padTop = 8;
  const padBottom = 28;

  const values = data.map((d) => d.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = data.map((d, i) => ({
    x: padX + (data.length === 1 ? 0.5 : i / (data.length - 1)) * (W - padX * 2),
    y: padTop + (1 - (d.value - min) / range) * (height - padTop - padBottom),
    d,
  }));

  // Horizontal-tangent cubic segments: smooth without overshooting, so the
  // curve never implies values the data does not contain.
  const line = points
    .map((p, i) => {
      if (i === 0) return `M${p.x},${p.y}`;
      const prev = points[i - 1];
      const cx = (prev.x + p.x) / 2;
      return `C${cx},${prev.y} ${cx},${p.y} ${p.x},${p.y}`;
    })
    .join(' ');

  const area = `${line} L${points.at(-1)!.x},${height - padBottom} L${points[0].x},${height - padBottom} Z`;
  const gridLines = Array.from({ length: 4 }, (_, i) => padTop + (i / 3) * (height - padTop - padBottom));
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));
  const hovered = active === null ? null : points[active];

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="block w-full"
        style={{ height }}
        onMouseLeave={() => setActive(null)}
        role="img"
        aria-label={`Serie temporal de ${data.length} puntos`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridLines.map((y, i) => (
          <line
            key={i}
            x1={padX}
            y1={y}
            x2={W - padX}
            y2={y}
            stroke="var(--color-border-light)"
            strokeWidth="1"
          />
        ))}

        <path d={area} fill={`url(#${gradientId})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />

        {points.map((p, i) =>
          i % labelEvery === 0 || i === points.length - 1 ? (
            <text
              key={`l${i}`}
              x={p.x}
              y={height - 8}
              textAnchor="middle"
              fontSize="9"
              fill="var(--color-text-secondary)"
            >
              {p.d.label}
            </text>
          ) : null
        )}

        {hovered ? (
          <>
            <line
              x1={hovered.x}
              y1={padTop}
              x2={hovered.x}
              y2={height - padBottom}
              stroke={color}
              strokeWidth="1"
              strokeDasharray="4 3"
            />
            <circle
              cx={hovered.x}
              cy={hovered.y}
              r="4"
              fill={color}
              stroke="var(--color-surface)"
              strokeWidth="2"
            />
          </>
        ) : null}

        {points.map((p, i) => (
          <rect
            key={`h${i}`}
            x={p.x - (W / data.length) / 2}
            y={0}
            width={W / data.length}
            height={height}
            fill="transparent"
            onMouseEnter={() => setActive(i)}
          />
        ))}
      </svg>

      {hovered ? (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-[8px] border border-line-strong bg-surface-container px-2.5 py-1.5 text-[12px]"
          style={{
            top: Math.max(4, (hovered.y / height) * height - 42),
            left: `${Math.min(Math.max((hovered.x / W) * 100, 10), 90)}%`,
          }}
        >
          <div className="font-bold" style={{ color }}>
            {hovered.d.label}
          </div>
          <div className="text-muted">{hovered.d.formatted}</div>
        </div>
      ) : null}
    </div>
  );
}
