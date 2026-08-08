'use client';

import type { ComponentProps } from 'react';
import { Icon } from '@/components/ui/Icon';

/**
 * Native <select> with the OS chrome stripped and our own chevron drawn on
 * top. Native is deliberate over a custom listbox here: it keeps keyboard,
 * screen-reader and mobile-wheel behaviour for free, and these are short,
 * low-stakes option lists. FilterMenu earns its custom implementation because
 * it needs multi-select and search; this doesn't.
 *
 * The focus treatment is local rather than the global lime :focus-visible
 * outline — a hard 2px rect around a rounded control reads as a rendering
 * bug. Border + ring in the same accent stays just as visible without it.
 */
export function Select({ className = '', children, ...props }: ComponentProps<'select'>) {
  return (
    <div className="relative inline-flex">
      <select
        {...props}
        className={`w-full appearance-none rounded-sm border border-line-strong bg-surface-container py-2 pl-3 pr-8 text-xs font-semibold text-text-primary transition-colors hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/25 focus-visible:outline-none ${className}`}
      >
        {children}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"
      >
        <Icon name="chevronDown" size={13} />
      </span>
    </div>
  );
}

/** Small uppercase caption sitting above a control. */
export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-2xs font-bold uppercase tracking-[0.08em] text-muted">
      {children}
    </span>
  );
}
