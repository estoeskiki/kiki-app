import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Viewer, ViewerContext } from '@/lib/types';

/**
 * Data Access Layer — the authorization boundary for the whole app.
 *
 * Next's own docs are explicit that proxy.ts (formerly middleware) is "not
 * intended ... as a full session management or authorization solution": it runs
 * before the route is resolved and is optimised for redirects, so it can be
 * bypassed or race a stale cookie. Every layout, page and Server Action
 * therefore re-checks here, and Postgres RLS backs it up if one ever forgets.
 *
 * getUser() is used rather than getSession(): getSession() reads the cookie and
 * trusts it, while getUser() revalidates the JWT with the auth server. Only the
 * latter is safe to authorize on.
 *
 * cache() dedupes for the lifetime of a single request, so a layout and three
 * nested pages calling requireViewer() cost one auth round trip and one RPC.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const { data, error: ctxError } = await supabase.rpc('get_viewer_context');
  if (ctxError) {
    console.error('[dal] get_viewer_context failed:', ctxError.message);
    return null;
  }

  const ctx = data as unknown as ViewerContext;

  return {
    ...ctx,
    restaurant_ids: ctx.restaurant_ids ?? [],
    food_court_ids: ctx.food_court_ids ?? [],
    email: user.email ?? '',
  };
});

/** Use in any authenticated layout/page. Redirects to /login when signed out. */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect('/login');
  return viewer;
}

/**
 * Platform-operator-only routes (organizations, food-court lifecycle, platform
 * settings). Deliberately redirects to the dashboard root rather than /login:
 * the user is authenticated, just not permitted, and a login prompt would be a
 * confusing lie.
 *
 * Note this is defence in depth, not the only guard — the underlying tables are
 * also restricted to is_platform_admin() by RLS.
 */
export async function requirePlatformAdmin(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!viewer.is_platform_admin) redirect('/');
  return viewer;
}

/**
 * Roles allowed to mutate menus, orders and settings. `staff` can edit menu
 * items and advance orders; `kiosk_device` is a paired device, never a human,
 * and must never reach the admin UI.
 */
export function canWrite(viewer: Viewer): boolean {
  if (viewer.is_platform_admin) return true;
  return viewer.role === 'owner' || viewer.role === 'manager' || viewer.role === 'staff';
}

/** Destructive or structural changes: create/delete restaurants, manage people. */
export function canAdminister(viewer: Viewer): boolean {
  if (viewer.is_platform_admin) return true;
  return viewer.role === 'owner' || viewer.role === 'manager';
}
