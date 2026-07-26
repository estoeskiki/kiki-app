'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { canAdminister, requireViewer } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';

/**
 * Team management.
 *
 * Role and membership changes go straight to the tables under RLS. Creating an
 * account cannot — auth.users lives behind the Admin API — so that one case is
 * delegated to the admin-invite-user Edge Function, which re-verifies the
 * caller's permissions with their own JWT before it touches the service role.
 * The service-role key is never present in this process.
 */

const uuid = z.string().uuid();
const role = z.enum(['owner', 'manager', 'staff']);

function fail(message: string): never {
  throw new Error(message);
}

const inviteSchema = z.object({
  email: z.string().email().max(200),
  // Long enough that it is generated, not typed. Supabase enforces its own
  // minimum as well.
  password: z.string().min(12, 'Usa al menos 12 caracteres').max(200),
  display_name: z.string().trim().max(120).optional(),
  role,
  scope: z.string(),
});

export async function inviteMember(formData: FormData) {
  const viewer = await requireViewer();
  if (!canAdminister(viewer)) fail('No tienes permiso para invitar miembros');

  const parsed = inviteSchema.parse({
    email: formData.get('email'),
    password: formData.get('password'),
    display_name: formData.get('display_name') ?? '',
    role: formData.get('role'),
    scope: formData.get('scope'),
  });

  // scope arrives as "org:<uuid>", "restaurant:<uuid>" or "foodcourt:<uuid>".
  const [kind, id] = parsed.scope.split(':');
  if (!uuid.safeParse(id).success) fail('Ámbito inválido');

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) fail('Sesión expirada');

  const payload: Record<string, string> = {
    email: parsed.email,
    password: parsed.password,
    displayName: parsed.display_name ?? '',
    role: parsed.role,
  };

  if (kind === 'foodcourt') {
    payload.foodCourtId = id;
  } else if (kind === 'restaurant') {
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('org_id')
      .eq('id', id)
      .maybeSingle();

    if (!restaurant) fail('Restaurante fuera de alcance');
    payload.orgId = restaurant.org_id;
    payload.restaurantId = id;
  } else if (kind === 'org') {
    payload.orgId = id;
  } else {
    fail('Ámbito inválido');
  }

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-invite-user`,
    {
      method: 'POST',
      headers: {
        // The caller's own JWT — the function verifies their permissions with
        // it before doing anything privileged.
        Authorization: `Bearer ${session.access_token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const { error } = (await response.json().catch(() => ({ error: 'unknown' }))) as {
      error?: string;
    };
    const messages: Record<string, string> = {
      email_taken: 'Ese correo ya tiene una cuenta.',
      forbidden: 'No tienes permiso sobre ese ámbito.',
      weak_password: 'La contraseña es demasiado corta.',
      invalid_email: 'Correo inválido.',
      scope_mismatch: 'El restaurante no pertenece a esa organización.',
    };
    fail(messages[error ?? ''] ?? 'No se pudo crear el usuario.');
  }

  revalidatePath('/team');
}

export async function updateMemberRole(formData: FormData) {
  const viewer = await requireViewer();
  if (!canAdminister(viewer)) fail('No tienes permiso para cambiar roles');

  const id = uuid.parse(formData.get('id'));
  const table = z.enum(['org_members', 'food_court_members']).parse(formData.get('table'));
  const nextRole = role.parse(formData.get('role'));

  const supabase = await createClient();
  const { error } = await supabase.from(table).update({ role: nextRole }).eq('id', id);
  if (error) fail(error.message);

  revalidatePath('/team');
}

export async function removeMember(formData: FormData) {
  const viewer = await requireViewer();
  if (!canAdminister(viewer)) fail('No tienes permiso para quitar miembros');

  const id = uuid.parse(formData.get('id'));
  const table = z.enum(['org_members', 'food_court_members']).parse(formData.get('table'));
  const userId = uuid.parse(formData.get('user_id'));

  // Removing your own membership would leave you authenticated with an empty
  // scope and no way back in through the UI.
  if (userId === viewer.user_id) fail('No puedes quitarte a ti mismo');

  const supabase = await createClient();
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) fail(error.message);

  revalidatePath('/team');
}
