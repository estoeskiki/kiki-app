'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/**
 * Shell-level actions.
 *
 * These are Server Actions rather than POST route handlers on purpose: Next
 * validates the Origin/Host pair on every action invocation, so a cross-site
 * form cannot sign a user out or flip their session state. A plain route
 * handler accepting a form POST would have no such protection.
 */

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function setTheme(formData: FormData) {
  const requested = formData.get('theme');
  const theme = requested === 'light' ? 'light' : 'dark';

  (await cookies()).set('kiki-theme', theme, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
  });

  // The root layout reads this cookie to stamp data-theme before first paint.
  revalidatePath('/', 'layout');
}
