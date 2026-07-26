import type { ReactNode } from 'react';

/**
 * Table primitives matching the design reference.
 *
 * Wrapped in an overflow-x container so a wide table scrolls inside its own
 * card instead of forcing the page body to scroll sideways.
 */
export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">{children}</table>
    </div>
  );
}

export function TH({
  children,
  align = 'left',
  className = '',
}: {
  children?: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`whitespace-nowrap border-b border-line px-4 py-[11px] text-[10px] font-bold uppercase tracking-[0.08em] text-muted ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${className}`}
    >
      {children}
    </th>
  );
}

export function TR({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <tr className={`border-b border-line transition-colors hover:bg-surface-container ${className}`}>
      {children}
    </tr>
  );
}

export function TD({
  children,
  align = 'left',
  className = '',
}: {
  children?: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <td className={`px-4 py-3 ${align === 'right' ? 'text-right' : ''} ${className}`}>{children}</td>
  );
}

/** Numeric cell: Space Grotesk + tabular figures so columns line up. */
export function NumCell({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`font-heading font-semibold tabular-nums ${className}`}>{children}</span>
  );
}
