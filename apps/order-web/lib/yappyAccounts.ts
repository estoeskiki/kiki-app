// ─── Yappy "pay ahead" handles (test / yappy-test branch) ───────────────────
// There is no payment integration yet. This is an informational prompt on the
// order tracker: while an order is being prepared, we show the restaurant's
// Yappy so the customer can pay ahead voluntarily.
//
// Keyed by restaurant NAME because the public tracker RPC
// (get_order_status_public) only exposes restaurant_name per sub_order, not its
// id. If this graduates past a test, move the handle onto restaurants.yappy_handle
// and return it from the RPC so it's data-driven instead of hardcoded here.
//
// Placeholder handles — swap for each restaurant's real Yappy before using for real.
const YAPPY_ACCOUNTS: Record<string, string> = {
  'El Invernadero': '@elinvernadero',
  'Stadium Eats': '@stadiumeats',
};

export function getYappyAccount(restaurantName: string): string | null {
  return YAPPY_ACCOUNTS[restaurantName] ?? null;
}
