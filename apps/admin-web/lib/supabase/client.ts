'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/types';

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

/**
 * Browser Supabase client, used only for realtime subscriptions (the Orders
 * feed) and for sign-out. All reads and writes that matter go through Server
 * Components and Server Actions.
 *
 * Memoised because each createBrowserClient() opens its own realtime socket.
 */
export function getBrowserClient() {
  client ??= createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return client;
}
