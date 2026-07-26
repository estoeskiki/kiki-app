import { cookies } from 'next/headers';
import { Sidebar } from '@/components/layout/Sidebar';
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
  const theme = (await cookies()).get('kiki-theme')?.value === 'light' ? 'light' : 'dark';

  return (
    <div className="flex min-h-dvh">
      <Sidebar viewer={viewer} items={navFor(viewer)} theme={theme} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
