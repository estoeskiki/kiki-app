import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { CONTENT_WIDTH } from '@/components/ui/Container';
import { RefreshButton } from '@/components/layout/RefreshButton';
import { setTheme, signOut } from '@/app/actions';
import type { Viewer } from '@/lib/types';

/**
 * Account strip above every page: greeting, avatar, theme, sign out.
 *
 * This used to live crammed into the sidebar footer — a small avatar, a
 * truncated email, and two icon buttons squeezed into one 40px row at the
 * bottom of a 220px-wide column. It was easy to miss entirely and read as an
 * afterthought. Every fintech reference dashboard puts identity at the top of
 * the page, not the bottom of the nav, so it moved here. The sidebar is nav
 * only now.
 */
export function TopBar({ viewer, theme }: { viewer: Viewer; theme: 'dark' | 'light' }) {
  const greeting = greetingFor(new Date());
  const firstName = (viewer.display_name ?? viewer.email.split('@')[0]).split(' ')[0];

  return (
    <div className="border-b border-line">
      <div className={`flex items-center justify-between gap-4 py-4 ${CONTENT_WIDTH}`}>
        <div>
          <h1 className="font-heading text-lg font-bold tracking-[-0.02em] text-text-primary">
            {greeting}, {firstName}
          </h1>
          <p className="mt-0.5 text-xs text-muted">
            {viewer.is_platform_admin ? 'Vista de todas las organizaciones' : 'Tu resumen de hoy'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <RefreshButton />

          <span className="h-6 w-px bg-line" aria-hidden />

          {/* A real two-state switch, not an icon button — matches how the
              reference dashboards render this control, and reads at a glance
              as "here is the current mode" rather than "here is an action". */}
          <form action={setTheme}>
            <input type="hidden" name="theme" value={theme === 'dark' ? 'light' : 'dark'} />
            <button
              type="submit"
              role="switch"
              aria-checked={theme === 'light'}
              aria-label="Cambiar tema"
              title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
              className="relative flex h-7 w-[52px] shrink-0 cursor-pointer items-center rounded-full border border-line bg-surface-container px-1 transition-colors duration-200"
            >
              <Icon
                name="sun"
                size={12}
                className={`absolute left-1.5 transition-opacity duration-200 ${theme === 'dark' ? 'opacity-40' : 'opacity-0'}`}
              />
              <Icon
                name="moon"
                size={12}
                className={`absolute right-1.5 transition-opacity duration-200 ${theme === 'light' ? 'opacity-40' : 'opacity-0'}`}
              />
              <span
                aria-hidden
                className={`z-10 flex size-5 items-center justify-center rounded-full bg-primary text-on-primary shadow-[0_0_8px_rgba(204,255,0,0.5)] transition-transform duration-200 ${
                  theme === 'light' ? 'translate-x-[22px]' : 'translate-x-0'
                }`}
              >
                <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={11} strokeWidth={2.2} />
              </span>
            </button>
          </form>

          <span className="h-6 w-px bg-line" aria-hidden />

          <div className="flex items-center gap-2.5">
            <Avatar name={viewer.display_name} fallback={viewer.email} size="sm" />
            <div className="hidden text-left sm:block">
              <div className="max-w-[160px] truncate text-xs font-semibold text-text-primary">
                {viewer.display_name ?? viewer.email}
              </div>
              <div className="text-2xs text-muted">
                {viewer.is_platform_admin ? 'Super Admin' : (viewer.role ?? 'Sin rol')}
              </div>
            </div>
          </div>

          <form action={signOut}>
            <button
              type="submit"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="flex cursor-pointer items-center justify-center rounded-full p-2 text-muted transition-colors duration-200 hover:bg-surface-container hover:text-secondary"
            >
              <Icon name="signout" size={15} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}
