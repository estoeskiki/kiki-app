import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/Button';

export const metadata = { title: 'Iniciar sesión · Kiki' };

const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  // Relative path only. An absolute URL here would make this an open redirect.
  next: z.string().regex(/^\/[^/\\]/).optional(),
});

async function signIn(formData: FormData) {
  'use server';

  const parsed = credentials.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next') || undefined,
  });

  // One generic message for bad input and for wrong credentials alike: telling
  // the caller which of the two failed turns this form into an account
  // enumeration oracle.
  if (!parsed.success) redirect('/login?error=1');

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) redirect('/login?error=1');

  redirect(parsed.data.next ?? '/');
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-[360px]">
        <div className="mb-8 text-center">
          <div className="font-heading text-[34px] font-black leading-none tracking-[-0.05em] text-primary [text-shadow:0_0_24px_rgba(204,255,0,0.35),0_0_70px_rgba(204,255,0,0.12)]">
            KIKI
          </div>
          <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-muted">Consola Admin</p>
        </div>

        <form
          action={signIn}
          className="rounded-[12px] border border-line bg-surface p-6"
          // Never let a password manager or the browser cache the password field
          // into a URL; POST-only via Server Action.
        >
          <h1 className="mb-1 font-heading text-[18px] font-bold tracking-[-0.03em] text-text-primary">
            Iniciar sesión
          </h1>
          <p className="mb-5 text-[12px] text-muted">
            Usa las mismas credenciales de la app de administración.
          </p>

          {next ? <input type="hidden" name="next" value={next} /> : null}

          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
            Correo
            <input
              type="email"
              name="email"
              required
              autoComplete="username"
              autoFocus
              className="mt-1.5 w-full rounded-[8px] border border-line bg-surface-container px-3 py-2.5 text-[13px] font-normal normal-case tracking-normal text-text-primary outline-none focus:border-primary/40"
            />
          </label>

          <label className="mb-5 mt-4 block text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
            Contraseña
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              className="mt-1.5 w-full rounded-[8px] border border-line bg-surface-container px-3 py-2.5 text-[13px] font-normal normal-case tracking-normal text-text-primary outline-none focus:border-primary/40"
            />
          </label>

          {error ? (
            <p
              role="alert"
              className="mb-4 rounded-[8px] border border-secondary/30 bg-secondary/10 px-3 py-2 text-[12px] text-secondary"
            >
              Correo o contraseña incorrectos.
            </p>
          ) : null}

          <Button type="submit" className="w-full">
            Entrar
          </Button>
        </form>
      </div>
    </main>
  );
}
