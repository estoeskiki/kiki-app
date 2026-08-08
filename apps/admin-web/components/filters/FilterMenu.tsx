'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';

export type MenuOption = {
  id: string;
  label: string;
  /** Right-aligned qualifier, e.g. "oculto". */
  hint?: string;
  /** Small colour swatch before the label, for channels and the like. */
  swatch?: string;
};

export type MenuGroup = {
  label?: string;
  options: MenuOption[];
};

/**
 * Filter menu.
 *
 * Deliberately not a checkbox list. A column of drawn checkboxes reads as a form
 * to be filled in; a filter is a selection, so the whole row is the target and
 * state is shown by a check mark plus a tinted row. That is the pattern every
 * dense analytics product converges on, and it removes ~15px of visual noise per
 * row.
 *
 * Accessibility: this is a real listbox with `aria-multiselectable`, roving
 * `aria-selected`, and full keyboard support (↑/↓/Home/End to move, Enter/Space to
 * toggle, Escape to close, Tab to leave). Dropping the native checkboxes means
 * the semantics have to be supplied deliberately rather than inherited.
 *
 * Long lists get a filter field automatically — a 10-restaurant scope list is
 * faster to search than to scan.
 */
const SEARCH_THRESHOLD = 8;

export function FilterMenu({
  label,
  groups,
  selected,
  onToggle,
  onClear,
  width = 264,
}: {
  label: string;
  groups: MenuGroup[];
  selected: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const total = groups.reduce((n, g) => n + g.options.length, 0);
  const searchable = total > SEARCH_THRESHOLD;

  const visibleGroups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return groups;
    return groups
      .map((group) => ({
        ...group,
        options: group.options.filter((o) => o.label.toLowerCase().includes(needle)),
      }))
      .filter((group) => group.options.length > 0);
  }, [groups, query]);

  const flat = useMemo(() => visibleGroups.flatMap((g) => g.options), [visibleGroups]);

  // Reset in the close paths rather than in an effect watching `open`. Resetting
  // from an effect fires a second render every time the menu shuts, and the
  // intermediate state is briefly visible.
  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setCursor(0);
  }, []);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) close();
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, close]);

  const move = (delta: number) => {
    if (flat.length === 0) return;
    const next = (cursor + delta + flat.length) % flat.length;
    setCursor(next);
    listRef.current
      ?.querySelectorAll<HTMLElement>('[data-option]')
      ?.[next]?.scrollIntoView({ block: 'nearest' });
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        close();
        break;
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        break;
      case 'Home':
        event.preventDefault();
        setCursor(0);
        break;
      case 'End':
        event.preventDefault();
        setCursor(Math.max(0, flat.length - 1));
        break;
      case 'Enter':
      case ' ':
        if (flat[cursor]) {
          event.preventDefault();
          onToggle(flat[cursor].id);
        }
        break;
    }
  };

  const count = selected.length;
  let index = -1;

  return (
    <div className="relative" ref={ref} onKeyDown={onKeyDown}>
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-haspopup="listbox"
        // Solid filled pill once something is selected — a 10%-opacity tint on
        // top of an already-dark surface barely registered as "on" at all next
        // to the rest of the page; the filter chips in the fintech references
        // that inspired this are solid, not a faint wash.
        className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-200 ${
          count > 0
            ? 'bg-primary text-on-primary shadow-[0_0_10px_rgba(204,255,0,0.25)]'
            : open
              ? 'bg-surface-highlight text-text-primary'
              : 'text-text-secondary hover:bg-surface-container hover:text-text-primary'
        }`}
      >
        {label}
        {count > 0 ? <span className="tabular-nums opacity-70">· {count}</span> : null}
        <Icon
          name="chevronDown"
          size={11}
          className={`opacity-60 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open ? (
        <div
          style={{ width }}
          className="absolute left-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-md border border-line-strong/60 bg-surface-highlight shadow-[0_20px_50px_-12px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.04)]"
        >
          {searchable ? (
            <div className="border-b border-line px-2.5 py-2">
              <input
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setCursor(0);
                }}
                placeholder="Buscar…"
                aria-label={`Buscar en ${label}`}
                // The global :focus-visible rule in globals.css draws a 2px lime
                // outline for keyboard accessibility. `focus:outline-none` only
                // targets `:focus` — a different pseudo-class — so it never
                // suppressed that ring, and this autofocused input showed a boxy
                // lime outline on open. `focus-visible:outline-none` targets the
                // rule that's actually firing; the panel's own border is enough
                // to show the field is active.
                className="w-full bg-transparent text-xs text-text-primary placeholder:text-muted outline-none focus-visible:outline-none"
              />
            </div>
          ) : null}

          <div
            ref={listRef}
            role="listbox"
            aria-multiselectable
            aria-label={label}
            className="max-h-[300px] overflow-y-auto p-1.5"
          >
            {flat.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-muted">Sin resultados</p>
            ) : (
              visibleGroups.map((group, groupIndex) => (
                <div key={group.label ?? groupIndex}>
                  {group.label ? (
                    <div className="px-2 pb-1 pt-2 text-2xs font-semibold uppercase tracking-[0.1em] text-muted">
                      {group.label}
                    </div>
                  ) : null}

                  {group.options.map((option) => {
                    index += 1;
                    const isSelected = selected.includes(option.id);
                    const isCursor = index === cursor;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        data-option
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => onToggle(option.id)}
                        onMouseEnter={() => setCursor(flat.indexOf(option))}
                        className={`flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-[7px] text-left text-xs transition-colors duration-150 ${
                          isSelected ? 'text-text-primary' : 'text-text-secondary'
                        } ${isCursor ? 'bg-surface' : ''}`}
                      >
                        {option.swatch ? (
                          <span
                            aria-hidden
                            className={`size-1.5 shrink-0 rounded-full ${option.swatch}`}
                          />
                        ) : null}

                        <span className="min-w-0 flex-1 truncate">{option.label}</span>

                        {option.hint ? (
                          <span className="shrink-0 text-2xs text-muted">{option.hint}</span>
                        ) : null}

                        {/* Fixed-width slot so labels don't shift when toggled. */}
                        <span className="flex w-3.5 shrink-0 justify-center">
                          {isSelected ? (
                            <Icon name="check" size={13} className="text-primary" strokeWidth={2.5} />
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {count > 0 ? (
            <div className="border-t border-line px-1.5 py-1.5">
              <button
                type="button"
                onClick={onClear}
                className="w-full cursor-pointer rounded-sm px-2 py-1.5 text-left text-2xs font-semibold uppercase tracking-[0.06em] text-muted transition-colors duration-150 hover:bg-surface hover:text-secondary"
              >
                Quitar selección
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
