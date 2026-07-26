import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/types';

/**
 * Server-side Supabase client bound to the request's cookies.
 *
 * This uses the publishable anon key and the *user's own* session — never the
 * service role. Every query it issues is therefore evaluated by Postgres RLS
 * under that user's identity, which is what makes the multi-tenant scoping in
 * this app trustworthy: a bug in a page cannot leak another tenant's rows,
 * because the database would refuse to return them.
 *
 * Must be created per request (cookies() is request-scoped); do not hoist the
 * result into a module-level singleton.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Components cannot set cookies. Session refresh is handled
            // in proxy.ts, which runs before rendering, so swallowing this is
            // safe — the refreshed cookie is already on the response.
          }
        },
      },
    }
  );
}
