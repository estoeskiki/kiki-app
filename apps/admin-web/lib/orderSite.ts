/**
 * Public ordering site (apps/order-web). Override per environment with
 * NEXT_PUBLIC_ORDER_SITE_URL, e.g. a preview deploy.
 */
export const ORDER_SITE_URL = (
  process.env.NEXT_PUBLIC_ORDER_SITE_URL ?? 'https://order.estoeskiki.com'
).replace(/\/+$/, '');

const ORDER_SITE_HOST = ORDER_SITE_URL.replace(/^https?:\/\//, '');

/**
 * The storefront link a zone's QR encodes. Demo zones (migration 047) use
 * their slug as the token and get the short /demo-N alias order-web serves.
 * `display` truncates a real token — it is a bearer credential (see ZonesCard).
 */
export function zoneOrderLink(qrToken: string): { url: string; display: string } {
  if (/^demo-\d+$/.test(qrToken)) {
    return { url: `${ORDER_SITE_URL}/${qrToken}`, display: `${ORDER_SITE_HOST}/${qrToken}` };
  }
  return {
    url: `${ORDER_SITE_URL}/t/${qrToken}`,
    display: `${ORDER_SITE_HOST}/t/…${qrToken.slice(-6)}`,
  };
}
