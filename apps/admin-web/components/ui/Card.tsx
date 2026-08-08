import type { ReactNode } from 'react';

/**
 * Surface primitive. Depth comes from three things stacked together: the
 * surface/background luminance step (see the dark-mode override in
 * globals.css — the default @kiki/ui-tokens step was 1.10:1, close enough to
 * invisible that no amount of spacing or radius tuning around it would have
 * fixed it), a hairline border, and a soft two-layer shadow — a tight low-
 * opacity contact shadow plus a wider, softer ambient one underneath. The
 * ambient-glow half of that pairing is consistent with the rest of the app:
 * the primary button and the KIKI wordmark already use the same soft-glow
 * language.
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
    // overflow-hidden so children actually clip to the radius. Without it a table
    // row's hover background or a list divider paints square into the rounded
    // corner, which is what makes an otherwise-rounded card still read as sharp.
    <Tag
      className={`overflow-hidden rounded-lg border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.35),0_10px_28px_-14px_rgba(0,0,0,0.6)] ${className}`}
    >
      {children}
    </Tag>
  );
}

/** Uppercase micro-label: 10px, 700, wide tracking. Used above every metric. */
export function CardLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`text-2xs font-bold uppercase tracking-[0.09em] text-muted ${className}`}
    >
      {children}
    </div>
  );
}

/** Section heading inside a card — Space Grotesk, tight negative tracking. */
export function CardTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h2
      className={`font-heading text-sm font-semibold tracking-[-0.02em] text-text-primary ${className}`}
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
        <h1 className="font-heading text-xl font-bold tracking-[-0.04em] text-text-primary">
          {title}
        </h1>
        {subtitle ? <p className="mt-1 text-xs text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="p-8 text-center text-xs text-muted">{children}</div>;
}
