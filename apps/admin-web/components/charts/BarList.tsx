import type { ReactNode } from 'react';

export type BarRow = {
  key: string;
  label: ReactNode;
  value: ReactNode;
  /** 0–1. Bar width relative to the largest row. */
  ratio: number;
  tone?: 'lime' | 'cyan' | 'pink' | 'fade';
  /** Optional second line under the bar. */
  meta?: ReactNode;
};

const TONE: Record<NonNullable<BarRow['tone']>, string> = {
  lime: 'bg-primary',
  cyan: 'bg-tertiary',
  pink: 'bg-secondary',
  fade: 'bg-text-secondary/50',
};

/**
 * Horizontal bar list — the reference's shared shape for top items, the status
 * funnel, and the channel / zone breakdowns. One component so all four read as
 * the same object rather than four slightly different charts.
 */
export function BarList({ rows, emptyLabel = 'Sin datos' }: { rows: BarRow[]; emptyLabel?: string }) {
  if (rows.length === 0) {
    return <p className="py-4 text-[12px] text-muted">{emptyLabel}</p>;
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((row) => (
        <li key={row.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[11px]">
            <span className="min-w-0 truncate text-muted">{row.label}</span>
            <span className="shrink-0 font-heading font-semibold tabular-nums text-text-primary">
              {row.value}
            </span>
          </div>
          <div className="h-[5px] overflow-hidden rounded-[3px] bg-line">
            <div
              className={`h-full rounded-[3px] transition-[width] duration-500 ${TONE[row.tone ?? 'lime']}`}
              style={{ width: `${Math.max(0, Math.min(1, row.ratio)) * 100}%` }}
            />
          </div>
          {row.meta ? <div className="mt-1 text-[10px] text-muted">{row.meta}</div> : null}
        </li>
      ))}
    </ul>
  );
}
