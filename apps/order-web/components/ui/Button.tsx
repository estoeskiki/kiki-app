import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'xl';

const variantClasses: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary hover:brightness-95 shadow-[0_4px_20px_-4px_rgba(204,255,0,0.5)]',
  secondary: 'bg-secondary text-white hover:brightness-95',
  ghost: 'bg-transparent text-text-primary border border-border hover:bg-surface-container',
  danger: 'bg-error text-white hover:brightness-95',
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-10 px-4 text-sm rounded-md',
  md: 'h-12 px-5 text-base rounded-lg',
  lg: 'h-14 px-6 text-lg rounded-lg',
  xl: 'h-16 px-8 text-lg rounded-xl',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant = 'primary', size = 'lg', className = '', disabled, ...props }: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className={`font-heading font-bold tracking-tight transition active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    />
  );
}
