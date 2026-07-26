'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { canAdminister, requireViewer } from '@/lib/auth/dal';
import { assertFoodCourtInScope, assertRestaurantInScope } from '@/lib/auth/scope';
import { createClient } from '@/lib/supabase/server';

/**
 * Kiosk device pairing.
 *
 * IMPORTANT — device_tokens.token_hash is NOT a hash. authenticate_device()
 * compares the value the kiosk sends directly against this column
 * (`WHERE dt.token_hash = p_token_hash`, see 001_schema.sql), and
 * apps/kiosk/src/store/useAuthStore.ts sends the token the operator typed. So
 * the column stores the shared secret in clear text under a misleading name.
 *
 * That means anyone who can read this column can impersonate a kiosk. RLS keeps
 * it to owners/managers of the owning restaurant, which is why the fleet page
 * shows only the last few characters. Changing it to a real hash would require
 * changing authenticate_device and re-pairing every deployed kiosk, so it is
 * flagged rather than silently altered here.
 *
 * The token is generated server-side with a CSPRNG and returned to the caller
 * exactly once — it is never rendered again after the page that created it.
 */

const uuid = z.string().uuid();

function fail(message: string): never {
  throw new Error(message);
}

export type IssueTokenState = { token?: string; error?: string };

/**
 * Shaped for useActionState so the generated token can be rendered once in the
 * response. It is deliberately never redirected into a URL, written to a
 * cookie, or re-queryable — after the operator navigates away it exists only in
 * the database and on the kiosk.
 */
export async function issueDeviceToken(
  _prev: IssueTokenState,
  formData: FormData
): Promise<IssueTokenState> {
  try {
    const viewer = await requireViewer();
    if (!canAdminister(viewer)) return { error: 'No tienes permiso para emitir tokens' };

    const deviceName = z.string().trim().min(2).max(80).parse(formData.get('device_name'));

    const scope = String(formData.get('scope') ?? '');
    const [kind, id] = scope.split(':');
    if (!uuid.safeParse(id).success) return { error: 'Ámbito inválido' };

    const restaurantId = kind === 'restaurant' ? id : null;
    const foodCourtId = kind === 'foodcourt' ? id : null;

    if (!restaurantId && !foodCourtId) return { error: 'Indica un restaurante o un patio' };
    if (restaurantId) await assertRestaurantInScope(restaurantId);
    if (foodCourtId) await assertFoodCourtInScope(foodCourtId);

    // CSPRNG, uppercase and grouped so it can be read aloud and typed on a
    // kiosk without ambiguity.
    const token = randomBytes(24)
      .toString('base64url')
      .replace(/[-_]/g, '')
      .toUpperCase()
      .slice(0, 16)
      .replace(/(.{4})(?=.)/g, '$1-');

    const supabase = await createClient();
    const { error } = await supabase.from('device_tokens').insert({
      device_name: deviceName,
      token_hash: token,
      restaurant_id: restaurantId,
      food_court_id: foodCourtId,
      is_active: true,
    });

    if (error) return { error: error.message };

    revalidatePath('/kiosks');
    return { token };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo emitir el token' };
  }
}

export async function setDeviceActive(formData: FormData) {
  const viewer = await requireViewer();
  if (!canAdminister(viewer)) fail('No tienes permiso para cambiar dispositivos');

  const id = uuid.parse(formData.get('id'));
  const value = formData.get('value') === 'true';

  const supabase = await createClient();
  const { error } = await supabase.from('device_tokens').update({ is_active: value }).eq('id', id);
  if (error) fail(error.message);

  revalidatePath('/kiosks');
}

export async function deleteDevice(formData: FormData) {
  const viewer = await requireViewer();
  // Matches the RLS policy: only an owner may delete a device token.
  if (!viewer.is_platform_admin && viewer.role !== 'owner') {
    fail('Solo el propietario puede eliminar dispositivos');
  }

  const id = uuid.parse(formData.get('id'));

  const supabase = await createClient();
  const { error } = await supabase.from('device_tokens').delete().eq('id', id);
  if (error) fail(error.message);

  revalidatePath('/kiosks');
}
