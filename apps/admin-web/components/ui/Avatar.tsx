/**
 * Gradient-initials avatar. Was duplicated (Sidebar, Team page) with slightly
 * different initial-extraction logic in each; consolidated to one correct
 * version so every avatar in the app is actually the same component, not three
 * similar-looking divs that could drift.
 */
export function initialsFor(name: string | null | undefined, fallback: string): string {
  const source = name?.trim() || fallback;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? '?').concat(parts[1]?.[0] ?? '').toUpperCase();
}

const SIZE = {
  sm: 'size-7 text-2xs',
  md: 'size-8 text-2xs',
  lg: 'size-10 text-xs',
} as const;

export function Avatar({
  name,
  fallback,
  size = 'md',
  className = '',
}: {
  name: string | null | undefined;
  /** Used for initials when `name` is empty, e.g. an email address. */
  fallback: string;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-heading font-extrabold text-on-primary ${SIZE[size]} ${className}`}
      style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-tertiary))' }}
      aria-hidden
    >
      {initialsFor(name, fallback)}
    </div>
  );
}
