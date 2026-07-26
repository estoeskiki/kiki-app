'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';

/**
 * Small dropdown used by the filter bar's multi-selects.
 *
 * Closes on Escape and on outside pointerdown. Not a full ARIA listbox — the
 * panel holds ordinary checkboxes, which keyboard users can already reach and
 * operate, so a custom widget role would remove behaviour rather than add it.
 */
export function Popover({
  label,
  summary,
  count,
  children,
}: {
  label: string;
  summary: string;
  count: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`flex items-center gap-1.5 rounded-[8px] border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
          count > 0
            ? 'border-primary/35 bg-primary/10 text-primary'
            : 'border-line text-muted hover:text-text-primary'
        }`}
      >
        <span className="uppercase tracking-[0.06em]">{label}</span>
        <span className="max-w-[130px] truncate font-normal normal-case tracking-normal opacity-80">
          {summary}
        </span>
        <Icon name="chevronDown" size={11} />
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 max-h-[320px] w-[260px] overflow-y-auto rounded-[10px] border border-line-strong bg-surface-container p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.45)]">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function PopoverGroupLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2 pb-1 pt-2 text-[9px] font-bold uppercase tracking-[0.12em] text-muted">
      {children}
    </div>
  );
}

export function CheckRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2 rounded-[6px] px-2 py-1.5 text-[12px] transition-colors hover:bg-surface ${
        checked ? 'text-primary' : 'text-text-primary'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="size-[13px] shrink-0 accent-[var(--color-primary)]"
      />
      <span className="min-w-0 truncate">{children}</span>
    </label>
  );
}
