import 'server-only';

import { createClient } from '@/lib/supabase/server';

/**
 * Confirms a restaurant id supplied by the client is one the caller can
 * actually reach, by asking the database under that caller's own session.
 *
 * RLS already refuses writes to restaurants outside scope, so this is not the
 * thing that keeps tenants apart — it exists so an out-of-scope id fails as a
 * clear, early error instead of a confusing empty-result write that silently
 * changes nothing. Never replace an RLS policy with a check like this.
 */
export async function assertRestaurantInScope(restaurantId: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .maybeSingle();

  if (error || !data) {
    throw new Error('Restaurante fuera de alcance');
  }
}

/** Same idea for food courts. */
export async function assertFoodCourtInScope(foodCourtId: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('food_courts')
    .select('id')
    .eq('id', foodCourtId)
    .maybeSingle();

  if (error || !data) {
    throw new Error('Patio de comida fuera de alcance');
  }
}
