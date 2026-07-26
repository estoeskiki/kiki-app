import type { ReactNode } from 'react';

/**
 * Surface primitive from the design reference: 12px radius, 1px hairline
 * border, no shadow. Depth in this system comes from the border and the
 * background step, not from elevation.
 */
export function Card({
  children,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
}) {
  return (
    <Tag className={`rounded-[12px] border border-line bg-surface ${className}`}>{children}</Tag>
  );
}

/** Uppercase micro-label: 10px, 700, wide tracking. Used above every metric. */
export function CardLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`text-[10px] font-bold uppercase tracking-[0.09em] text-muted ${className}`}
    >
      {children}
    </div>
  );
}

/** Section heading inside a card — Space Grotesk, tight negative tracking. */
export function CardTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h2
      className={`font-heading text-[13px] font-semibold tracking-[-0.02em] text-text-primary ${className}`}
    >
      {children}
    </h2>
  );
}

export function PageHeading({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-heading text-[22px] font-bold tracking-[-0.04em] text-text-primary">
          {title}
        </h1>
        {subtitle ? <p className="mt-1 text-[12px] text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="p-8 text-center text-[12px] text-muted">{children}</div>;
}
