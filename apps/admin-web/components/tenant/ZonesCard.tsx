import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardLabel, CardTitle } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { createZone, setZoneActive } from '@/app/(dashboard)/restaurants/actions';

export type ZoneRow = {
  id: string;
  label: string;
  is_active: boolean;
  allows_manual_number: boolean;
  qr_token: string;
};

/**
 * Zones — the `tables` rows an order can be attributed to (Sala VIP, Palco #1,
 * Mesa 5). This is the same list the Overview "Zonas" card reports on and the
 * filter bar filters by.
 *
 * qr_token is the bearer credential embedded in the printed QR: anyone holding
 * it can open that zone's storefront. It is shown truncated and only to users
 * who can already administer the zone, and it is never accepted as input — the
 * schema generates it.
 */
export function ZonesCard({
  zones,
  restaurantId,
  foodCourtId,
  canEdit,
  title = 'Zonas',
  hint,
}: {
  zones: ZoneRow[];
  restaurantId?: string;
  foodCourtId?: string;
  canEdit: boolean;
  title?: string;
  hint?: string;
}) {
  return (
    <Card className="p-5">
      <CardTitle className="mb-1">{title}</CardTitle>
      {hint ? <CardLabel className="mb-4">{hint}</CardLabel> : <div className="mb-4" />}

      {zones.length === 0 ? (
        <p className="text-[12px] text-muted">Sin zonas configuradas.</p>
      ) : (
        <ul className="flex flex-col">
          {zones.map((zone) => (
            <li
              key={zone.id}
              className="flex items-center justify-between gap-2 border-b border-line py-2 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold text-text-primary">
                  {zone.label}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  {zone.allows_manual_number ? (
                    <Badge tone="pink">Nº de mesa manual</Badge>
                  ) : null}
                  {canEdit ? (
                    <code className="text-[10px] text-muted">
                      QR …{zone.qr_token.slice(-6)}
                    </code>
                  ) : null}
                </div>
              </div>

              {canEdit ? (
                <form action={setZoneActive}>
                  <input type="hidden" name="id" value={zone.id} />
                  <input type="hidden" name="value" value={String(!zone.is_active)} />
                  <button type="submit" aria-pressed={zone.is_active} className="cursor-pointer">
                    <Badge tone={zone.is_active ? 'lime' : 'neutral'}>
                      {zone.is_active ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </button>
                </form>
              ) : (
                <Badge tone={zone.is_active ? 'lime' : 'neutral'}>
                  {zone.is_active ? 'Activa' : 'Inactiva'}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <form action={createZone} className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
          <CardLabel>Nueva zona</CardLabel>
          {restaurantId ? <input type="hidden" name="restaurant_id" value={restaurantId} /> : null}
          {foodCourtId ? <input type="hidden" name="food_court_id" value={foodCourtId} /> : null}
          <input
            name="label"
            required
            maxLength={60}
            placeholder="p. ej. Palco #3"
            className="rounded-[7px] border border-line bg-surface-container px-2.5 py-1.5 text-[12px] text-text-primary outline-none focus:border-primary/40"
          />
          <label className="flex items-center gap-2 text-[12px] text-text-primary">
            <input
              type="checkbox"
              name="allows_manual_number"
              className="size-[14px] accent-[var(--color-primary)]"
            />
            El cliente escribe su número de mesa (estilo Sala VIP)
          </label>
          <Button type="submit" size="sm">
            <Icon name="plus" size={12} />
            Crear zona
          </Button>
        </form>
      ) : null}
    </Card>
  );
}
