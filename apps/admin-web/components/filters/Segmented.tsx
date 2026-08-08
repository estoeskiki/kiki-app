'use client';

import type { ReactNode } from 'react';

export type SegmentOption<T extends string> = {
  value: T;
  label: ReactNode;
  title?: string;
};

/**
 * Segmented control — one inset track with a single raised active segment.
 *
 * Replaces a row of individually-bordered buttons. Four separate outlined
 * buttons read as four unrelated actions; a segmented control reads as one
 * setting with four states, which is what a date range is. This is the standard
 * financial/analytics dashboard treatment (Stripe, Linear, Mercury).
 *
 * Rendered as a radiogroup so arrow keys and screen readers treat it as the
 * single choice it is, rather than four unrelated buttons.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: SegmentOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 rounded-md border border-line bg-surface-container p-[3px]"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={`cursor-pointer rounded-sm px-2.5 py-1 text-2xs font-semibold tabular-nums transition-colors duration-200 ${
              active
                ? 'bg-surface text-text-primary shadow-[0_1px_2px_rgba(0,0,0,0.3)]'
                : 'text-muted hover:text-text-primary'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
