import { setRestaurantFlag } from '@/app/(dashboard)/restaurants/actions';

/**
 * Open/closed switch for a restaurant, submitting setRestaurantFlag.
 *
 * A real two-state switch rather than the badge-in-a-button this replaces:
 * that rendered identically to the read-only badges elsewhere on the page, so
 * nothing signalled it was clickable at all. Same visual language as the theme
 * switch in TopBar.
 *
 * Server component on purpose — it's a plain form post, so there's no reason
 * to ship client JS for it. The optimistic-feeling slide is CSS on a value the
 * server already re-renders.
 */
export function FlagSwitch({
  id,
  field,
  value,
  label,
  disabled,
  size = 'md',
}: {
  id: string;
  field: 'is_open' | 'is_active';
  value: boolean;
  /** Accessible name — the visible caption, when there is one, is the caller's. */
  label: string;
  disabled: boolean;
  size?: 'sm' | 'md';
}) {
  const track = size === 'sm' ? 'h-5 w-9' : 'h-6 w-11';
  const knob = size === 'sm' ? 'size-3.5' : 'size-4.5';
  const shift = size === 'sm' ? 'translate-x-4' : 'translate-x-5';

  // No form, no submit target: a disabled switch is a state readout, and
  // rendering a button that can't act invites clicks that do nothing.
  if (disabled) {
    return (
      <span
        role="switch"
        aria-checked={value}
        aria-label={label}
        aria-disabled="true"
        title="No tienes permiso para cambiar esto"
        className={`relative flex ${track} shrink-0 items-center rounded-full border border-line px-0.5 opacity-50 ${
          value ? 'bg-primary/30' : 'bg-surface-container'
        }`}
      >
        <span
          aria-hidden
          className={`${knob} rounded-full bg-muted transition-transform duration-200 ${
            value ? shift : 'translate-x-0'
          }`}
        />
      </span>
    );
  }

  return (
    <form action={setRestaurantFlag} className="flex">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="field" value={field} />
      <input type="hidden" name="value" value={String(!value)} />
      <button
        type="submit"
        role="switch"
        aria-checked={value}
        aria-label={label}
        title={value ? 'Cerrar' : 'Abrir'}
        className={`relative flex ${track} shrink-0 cursor-pointer items-center rounded-full border px-0.5 transition-colors duration-200 focus-visible:outline-none focus:ring-2 focus:ring-primary/40 ${
          value
            ? 'border-primary/50 bg-primary/25'
            : 'border-line bg-surface-container hover:border-line-strong'
        }`}
      >
        <span
          aria-hidden
          className={`${knob} rounded-full transition-transform duration-200 ${
            value
              ? `bg-primary shadow-[0_0_8px_rgba(204,255,0,0.5)] ${shift}`
              : 'translate-x-0 bg-muted'
          }`}
        />
      </button>
    </form>
  );
}
