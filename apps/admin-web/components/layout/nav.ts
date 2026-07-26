import type { IconName } from '@/components/ui/Icon';
import type { Viewer } from '@/lib/types';

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  section?: string;
};

/**
 * Navigation is derived from the viewer, not hard-coded per role as in the
 * design reference's demo role-switcher.
 *
 * This is presentation only. Hiding a link is a courtesy, not a control: each
 * route re-checks with requireViewer()/requirePlatformAdmin(), and the tables
 * behind them are restricted by RLS regardless of what the sidebar renders.
 */
export function navFor(viewer: Viewer): NavItem[] {
  const items: NavItem[] = [
    { href: '/', label: 'Resumen', icon: 'overview' },
    { href: '/orders', label: 'Pedidos', icon: 'orders' },
  ];

  const manages = viewer.is_platform_admin || viewer.role === 'owner' || viewer.role === 'manager';

  items.push({ href: '/menu', label: 'Menú', icon: 'menu', section: 'Gestión' });
  items.push({ href: '/restaurants', label: 'Restaurantes', icon: 'restaurants' });

  if (viewer.is_platform_admin || viewer.food_court_ids.length > 0) {
    items.push({ href: '/food-courts', label: 'Patios de Comida', icon: 'foodcourts' });
  }

  if (viewer.is_platform_admin) {
    items.push({ href: '/organizations', label: 'Organizaciones', icon: 'analytics' });
  }

  if (manages) {
    items.push({ href: '/kiosks', label: 'Kioskos', icon: 'kiosks', section: 'Acceso' });
    items.push({ href: '/team', label: 'Equipo', icon: 'team' });
  }

  items.push({ href: '/settings', label: 'Ajustes', icon: 'settings', section: manages ? undefined : 'Acceso' });

  return items;
}

/** Longest-prefix match so /orders/<id> keeps "Pedidos" highlighted. */
export function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
