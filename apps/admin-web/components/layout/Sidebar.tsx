'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { isActive, type NavItem } from '@/components/layout/nav';
import { setTheme, signOut } from '@/app/actions';
import type { Viewer } from '@/lib/types';

function initials(name: string | null, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? '?').concat(parts[1]?.[0] ?? '').toUpperCase();
}

function scopeLabel(viewer: Viewer): string {
  if (viewer.is_platform_admin) return 'Todas las organizaciones';
  if (viewer.food_court_ids.length) return 'Patio de comida';
  const n = viewer.restaurant_ids.length;
  return n === 1 ? 'Un restaurante' : `${n} restaurantes`;
}

export function Sidebar({
  viewer,
  items,
  theme,
}: {
  viewer: Viewer;
  items: NavItem[];
  theme: 'dark' | 'light';
}) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-dvh w-[220px] min-w-[220px] flex-col border-r border-line bg-surface-container">
      <div className="border-b border-line px-5 pb-4 pt-6">
        <div className="font-heading text-[24px] font-black leading-none tracking-[-0.05em] text-primary [text-shadow:0_0_20px_rgba(204,255,0,0.35),0_0_60px_rgba(204,255,0,0.1)]">
          KIKI
        </div>
        <div className="mt-1 text-[9px] uppercase tracking-[0.18em] text-muted">Consola Admin</div>
      </div>

      {/* Scope indicator. Replaces the reference's mock role switcher — real
          scope comes from the session and cannot be switched from the UI. */}
      <div className="px-3 pb-1.5 pt-2.5">
        <div className="flex items-center gap-2 rounded-[8px] border border-line-strong bg-surface px-2.5 py-2">
          <span className="pulse-dot size-[7px] shrink-0 rounded-full bg-primary shadow-[0_0_6px_var(--color-primary)]" />
          <div className="min-w-0">
            <div className="truncate text-[12px] font-semibold text-text-primary">
              {viewer.is_platform_admin ? 'Super Admin' : (viewer.display_name ?? 'Equipo')}
            </div>
            <div className="truncate text-[9px] text-muted">{scopeLabel(viewer)}</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-1.5" aria-label="Principal">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <div key={item.href}>
              {item.section ? (
                <div className="px-2.5 pb-1.5 pt-4 text-[9px] font-bold uppercase tracking-[0.12em] text-muted">
                  {item.section}
                </div>
              ) : null}
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`mb-px flex items-center gap-2.5 rounded-[7px] border px-2.5 py-2 text-[13px] transition-colors ${
                  active
                    ? 'border-primary/20 bg-primary/[0.07] font-semibold text-primary'
                    : 'border-transparent text-muted hover:text-text-primary'
                }`}
              >
                <Icon name={item.icon} size={15} />
                <span>{item.label}</span>
              </Link>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2.5">
          <div
            className="flex size-8 shrink-0 items-center justify-center rounded-full font-heading text-[11px] font-extrabold text-on-primary"
            style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-tertiary))' }}
            aria-hidden
          >
            {initials(viewer.display_name, viewer.email)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-semibold text-text-primary">{viewer.email}</div>
            <div className="text-[10px] text-muted">
              {viewer.is_platform_admin ? 'Super Admin' : (viewer.role ?? 'Sin rol')}
            </div>
          </div>
        </div>

        <div className="mt-2.5 flex items-center gap-1.5">
          <form action={setTheme} className="flex-1">
            <input type="hidden" name="theme" value={theme === 'dark' ? 'light' : 'dark'} />
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-1.5 rounded-[7px] border border-line px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-muted transition-colors hover:text-text-primary"
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={12} />
              {theme === 'dark' ? 'Claro' : 'Oscuro'}
            </button>
          </form>

          <form action={signOut}>
            <button
              type="submit"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="flex items-center justify-center rounded-[7px] border border-line p-[7px] text-muted transition-colors hover:border-secondary/40 hover:text-secondary"
            >
              <Icon name="signout" size={13} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
