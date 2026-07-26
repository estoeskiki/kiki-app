import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Next.js 16 renamed Middleware to Proxy (same semantics, new file convention —
 * see node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
 *
 * This does three things:
 *   1. Issues a per-request CSP nonce (see below).
 *   2. Refreshes the Supabase auth cookies, so a long-lived tab does not fall
 *      out of session mid-navigation. Server Components cannot write cookies,
 *      so this is the only place the rotation can happen.
 *   3. An *optimistic* redirect to /login for requests with no session, purely
 *      to avoid rendering a shell that is about to be thrown away.
 *
 * It is NOT the authorization boundary. Next's docs say plainly that Proxy
 * "should not be used as a full session management or authorization solution".
 * Real enforcement is lib/auth/dal.ts on every route, with Postgres RLS behind
 * it. Nothing here decides what data anyone may see.
 */

const SUPABASE_ORIGIN = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return '';
  try {
    const { host, protocol } = new URL(url);
    return `${protocol}//${host} ${protocol === 'https:' ? 'wss:' : 'ws:'}//${host}`;
  } catch {
    return '';
  }
})();

/**
 * Builds the Content-Security-Policy for one request.
 *
 * The CSP lives here rather than in next.config.ts because a nonce must be
 * unpredictable and unique *per request*, and a static headers() entry cannot
 * be. This is the recipe from
 * node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md.
 *
 * script-src carries no 'unsafe-inline': Next's inline bootstrap scripts are
 * authorised by the nonce instead, and 'strict-dynamic' lets those nonced
 * scripts pull in the chunks they need. That combination is the whole point —
 * an injected <script> (from a menu item name, a customer name, an order note)
 * has no nonce and simply will not execute. Browsers that support
 * 'strict-dynamic' ignore the 'self' fallback beside it; older ones fall back
 * to 'self', which is still far better than allowing arbitrary inline script.
 *
 * 'unsafe-eval' is added in development ONLY. React's dev build uses eval() for
 * debugging features and Turbopack's HMR runtime needs it; React never calls
 * eval() in a production build. Per the Next docs: "unsafe-eval is not required
 * for production."
 *
 * style-src deliberately keeps 'unsafe-inline'. Nonce-ing styles breaks
 * Turbopack's injected style tags in dev, and an inline *style* cannot execute
 * code — the XSS risk it carries is a small fraction of an inline script's. It
 * is an explicit trade, not an oversight.
 */
function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV !== 'production';

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    // Deliberately 'unsafe-inline', unlike script-src. Reasoning, since this
    // looks inconsistent next to the nonce above:
    //
    // The charts are built from inline style="" attributes — bar widths,
    // area-chart heights, heatmap intensities, the sidebar gradient. A nonce
    // cannot authorise an attribute; nonces apply to elements only. The
    // CSP-correct split is style-src (nonce) + style-src-attr 'unsafe-inline',
    // and that was tried — but style-src-attr is CSP Level 3 and Firefox does
    // not implement it. A browser that does not recognise the directive falls
    // back to style-src, which would then be nonce-only, and every chart in the
    // app renders unstyled. That is a guaranteed breakage traded for defence
    // against a vector this app has no entry point for: there is no
    // dangerouslySetInnerHTML anywhere, and every inline style value is a
    // computed number or a literal from a union, never user data.
    //
    // Revisit if user-controlled HTML is ever rendered, or once Firefox ships
    // style-src-attr. Note an inline style cannot execute script; the risk it
    // carries (selector-based exfiltration, UI redressing) needs an injected
    // <style> block, which requires an injection point that does not exist here.
    "style-src 'self' 'unsafe-inline'",
    // Menu images, logos and welcome backgrounds come from Supabase Storage.
    `img-src 'self' data: blob: ${SUPABASE_ORIGIN}`,
    "font-src 'self' data:",
    // https for REST + auth, wss for realtime order updates.
    `connect-src 'self' ${SUPABASE_ORIGIN}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ]
    .join('; ')
    .replace(/\s{2,}/g, ' ');
}

export async function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const csp = buildCsp(nonce);

  // Next reads the nonce off the *request* headers to stamp it onto the script
  // tags it renders, so this must be set on the inbound headers, not only the
  // response.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not remove: this call is what performs the cookie refresh.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isLogin = pathname === '/login';

  if (!user && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // Preserve where they were heading so login can bounce them back. Only the
    // path is carried, never an absolute URL, so this cannot become an open
    // redirect.
    if (pathname !== '/') url.searchParams.set('next', pathname);
    const redirect = NextResponse.redirect(url);
    redirect.headers.set('Content-Security-Policy', csp);
    return redirect;
  }

  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    const redirect = NextResponse.redirect(url);
    redirect.headers.set('Content-Security-Policy', csp);
    return redirect;
  }

  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets — those never carry a
    // session and would only add latency.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
