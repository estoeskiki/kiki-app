import type { ComponentProps, ReactNode } from 'react';
import Link from 'next/link';

export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';

const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-[8px] font-bold uppercase tracking-[0.06em] transition-colors disabled:cursor-not-allowed disabled:opacity-50';

const VARIANT: Record<ButtonVariant, string> = {
  // The lime glow is the one piece of chrome the reference keeps — it marks the
  // single primary action on a screen.
  primary:
    'bg-primary text-on-primary shadow-[0_0_14px_rgba(204,255,0,0.22),0_0_36px_rgba(204,255,0,0.08)] hover:brightness-95',
  outline: 'border border-line-strong text-text-primary hover:bg-surface-highlight',
  ghost: 'border border-line text-muted hover:text-text-primary hover:border-line-strong',
  danger: 'border border-secondary/40 text-secondary hover:bg-secondary/10',
};

const SIZE = {
  sm: 'px-2.5 py-[5px] text-[11px]',
  md: 'px-4 py-2 text-[12px]',
} as const;

type Size = keyof typeof SIZE;

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ComponentProps<'button'> & { variant?: ButtonVariant; size?: Size }) {
  return (
    <button className={`${BASE} ${VARIANT[variant]} ${SIZE[size]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({
  children,
  href,
  variant = 'primary',
  size = 'md',
  className = '',
}: {
  children: ReactNode;
  href: string;
  variant?: ButtonVariant;
  size?: Size;
  className?: string;
}) {
  return (
    <Link href={href} className={`${BASE} ${VARIANT[variant]} ${SIZE[size]} ${className}`}>
      {children}
    </Link>
  );
}
