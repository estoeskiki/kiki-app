'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { isActive, type NavItem } from '@/components/layout/nav';
import { setSidebarCollapsed } from '@/app/actions';

/**
 * Pure navigation — identity/theme/sign-out live in TopBar.
 *
 * Rebuilt against a concrete reference (two real product sidebars) rather than
 * general "make it nicer" guessing: the active item is a full solid pill, not a
 * thin left accent bar on an 8%-opacity tint — a wash that barely registered as
 * "on" against an already-dark page was the actual complaint. Rows also got
 * real room (py-2 / 1px gaps before) to breathe.
 *
 * Collapse persists via a cookie (setSidebarCollapsed, same mechanism as
 * setTheme) so it's a page-level prop, not client state — no hydration
 * mismatch, and it survives a reload instead of resetting every visit.
 */
export function Sidebar({ items, collapsed }: { items: NavItem[]; collapsed: boolean }) {
  const pathname = usePathname();

  return (
    <aside
      className={`sticky top-0 flex h-dvh shrink-0 flex-col border-r border-line bg-surface-container transition-[width] duration-200 ${
        collapsed ? 'w-[76px]' : 'w-[232px]'
      }`}
    >
      <div className={`flex items-center pb-5 pt-6 ${collapsed ? 'justify-center px-2' : 'justify-between px-5'}`}>
        <div className="font-heading text-2xl font-black leading-none tracking-[-0.05em] text-primary [text-shadow:0_0_20px_rgba(204,255,0,0.35),0_0_60px_rgba(204,255,0,0.1)]">
          {collapsed ? 'K' : 'KIKI'}
        </div>

        {!collapsed ? <CollapseToggle collapsed={false} /> : null}
      </div>

      {collapsed ? (
        <div className="px-2.5 pb-2">
          <CollapseToggle collapsed />
        </div>
      ) : null}

      <nav
        className={`flex flex-1 flex-col overflow-y-auto pb-4 ${collapsed ? 'px-2' : 'px-3'}`}
        aria-label="Principal"
      >
        {groupItems(items).map((group, groupIndex) => (
          <div
            key={group.section ?? 'primary'}
            // Group spacing lives here, on a real wrapper, instead of being
            // padding on a label that shares a box with a nav row — that older
            // shape is what let a stray `first:pt-0` silently cancel it.
            className={groupIndex === 0 ? '' : 'mt-6'}
          >
            {group.section && !collapsed ? (
              <h2 className="mb-2 px-3.5 text-2xs font-bold uppercase tracking-[0.14em] text-muted">
                {group.section}
              </h2>
            ) : null}

            {/* Collapsed hides the label, so the break has to be carried by a
                rule — otherwise the icons read as one undivided column. */}
            {group.section && collapsed ? (
              <div className="mx-2 mb-3 h-px bg-line" aria-hidden />
            ) : null}

            <ul className="flex flex-col gap-1.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      title={collapsed ? item.label : undefined}
                      // Full solid pill on the active row — high-contrast, not
                      // a tint. Icon strokeWidth steps up when active too,
                      // matching how the reference sidebars bolden it.
                      className={`flex items-center gap-3 rounded-full py-2.5 text-sm font-medium transition-colors duration-150 ${
                        collapsed ? 'justify-center px-0' : 'px-3.5'
                      } ${
                        active
                          ? 'bg-primary font-semibold text-on-primary shadow-[0_2px_12px_rgba(204,255,0,0.25)]'
                          : 'text-text-secondary hover:bg-surface hover:text-text-primary'
                      }`}
                    >
                      <Icon name={item.icon} size={18} strokeWidth={active ? 2.1 : 1.8} />
                      {!collapsed ? <span className="truncate">{item.label}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

/**
 * `section` marks the first item of a run, not a container — so a group is
 * "an item carrying a section, plus every item after it that doesn't."
 */
function groupItems(items: NavItem[]): { section?: string; items: NavItem[] }[] {
  const groups: { section?: string; items: NavItem[] }[] = [];
  for (const item of items) {
    if (item.section || groups.length === 0) {
      groups.push({ section: item.section, items: [item] });
    } else {
      groups[groups.length - 1].items.push(item);
    }
  }
  return groups;
}

function CollapseToggle({ collapsed }: { collapsed: boolean }) {
  return (
    <form action={setSidebarCollapsed}>
      <input type="hidden" name="collapsed" value={String(!collapsed)} />
      <button
        type="submit"
        aria-label={collapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}
        title={collapsed ? 'Expandir' : 'Contraer'}
        className="flex size-7 cursor-pointer items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-surface hover:text-text-primary"
      >
        <Icon
          name="chevronLeft"
          size={14}
          className={`transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
        />
      </button>
    </form>
  );
}
