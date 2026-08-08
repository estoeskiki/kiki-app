import { cookies } from 'next/headers';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { navFor } from '@/components/layout/nav';
import { requireViewer } from '@/lib/auth/dal';

/**
 * Authenticated shell.
 *
 * requireViewer() here is the gate for every route in this segment — proxy.ts
 * only does an optimistic redirect and is explicitly not an authorization
 * boundary. Nested pages call it again (deduped by React cache) so a route can
 * never be reached by rendering outside this layout.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  const cookieStore = await cookies();
  const theme = cookieStore.get('kiki-theme')?.value === 'light' ? 'light' : 'dark';
  const sidebarCollapsed = cookieStore.get('kiki-sidebar-collapsed')?.value === 'true';

  return (
    // overflow-x-clip on the shell: a single mis-sized child should degrade into
    // its own clipped card, never give the whole page a horizontal scrollbar.
    <div className="flex min-h-dvh overflow-x-clip">
      <Sidebar items={navFor(viewer)} collapsed={sidebarCollapsed} />
      <main className="min-w-0 flex-1">
        <TopBar viewer={viewer} theme={theme} />
        {children}
      </main>
    </div>
  );
}
