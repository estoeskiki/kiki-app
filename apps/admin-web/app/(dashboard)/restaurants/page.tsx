import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardLabel, EmptyState, PageHeading } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { NumCell, TableWrap, TD, TH, TR } from '@/components/ui/Table';
import { requireViewer } from '@/lib/auth/dal';
import { getScopeTree } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import { formatMoney, formatNumber, startOfLocalDay, addDays } from '@/lib/format';
import { createRestaurant } from './actions';

export const metadata = { title: 'Restaurantes · Kiki' };

/**
 * Restaurant directory with 30-day revenue per location.
 *
 * Totals come from dashboard_order_facts (grain: one row per order per
 * restaurant), so a food-court order contributes to each participating stall
 * separately instead of being double-counted into one.
 */
export default async function RestaurantsPage() {
  const viewer = await requireViewer();
  const scope = await getScopeTree();

  const from = addDays(startOfLocalDay(new Date()), -30);
  const supabase = await createClient();

  const { data: factRows } = await supabase
    .from('dashboard_order_facts')
    .select('restaurant_id, total, status')
    .gte('created_at', from.toISOString());

  const stats = new Map<string, { orders: number; revenue: number }>();
  for (const row of factRows ?? []) {
    if (row.status === 'cancelled' || !row.restaurant_id) continue;
    const entry = stats.get(row.restaurant_id) ?? { orders: 0, revenue: 0 };
    entry.orders += 1;
    entry.revenue += row.total ?? 0;
    stats.set(row.restaurant_id, entry);
  }

  const foodCourtName = new Map(scope.food_courts.map((fc) => [fc.id, fc.name]));
  const orgName = new Map(scope.organizations.map((org) => [org.id, org.name]));
  const canCreate = viewer.is_platform_admin || viewer.role === 'owner';

  return (
    <div className="fade-in px-7 pb-12 pt-6">
      <PageHeading
        title="Restaurantes"
        subtitle={`${scope.restaurants.length} ubicación${scope.restaurants.length === 1 ? '' : 'es'} · últimos 30 días`}
      />

      <Card>
        {scope.restaurants.length === 0 ? (
          <EmptyState>No tienes restaurantes asignados.</EmptyState>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <TH>Nombre</TH>
                {viewer.is_platform_admin ? <TH>Organización</TH> : null}
                <TH>Patio de comida</TH>
                <TH>Estado</TH>
                <TH align="right">Pedidos</TH>
                <TH align="right">Ingresos</TH>
                <TH />
              </tr>
            </thead>
            <tbody>
              {scope.restaurants.map((restaurant) => {
                const stat = stats.get(restaurant.id) ?? { orders: 0, revenue: 0 };
                return (
                  <TR key={restaurant.id}>
                    <TD>
                      <Link
                        href={`/restaurants/${restaurant.id}`}
                        className="font-semibold text-text-primary hover:text-primary"
                      >
                        {restaurant.name}
                      </Link>
                      <div className="text-[11px] text-muted">/{restaurant.slug}</div>
                    </TD>
                    {viewer.is_platform_admin ? (
                      <TD>
                        <span className="text-[12px] text-muted">
                          {orgName.get(restaurant.org_id) ?? '—'}
                        </span>
                      </TD>
                    ) : null}
                    <TD>
                      <span className="text-muted">
                        {restaurant.food_court_id
                          ? (foodCourtName.get(restaurant.food_court_id) ?? '—')
                          : 'Independiente'}
                      </span>
                    </TD>
                    <TD>
                      <div className="flex gap-1.5">
                        <Badge tone={restaurant.is_open ? 'lime' : 'neutral'}>
                          {restaurant.is_open ? 'Abierto' : 'Cerrado'}
                        </Badge>
                        {restaurant.is_active ? null : <Badge tone="pink">Oculto</Badge>}
                      </div>
                    </TD>
                    <TD align="right">
                      <NumCell className="text-text-primary">{formatNumber(stat.orders)}</NumCell>
                    </TD>
                    <TD align="right">
                      <NumCell className={stat.revenue ? 'text-primary' : 'text-muted'}>
                        {formatMoney(stat.revenue, restaurant.currency)}
                      </NumCell>
                    </TD>
                    <TD>
                      <Link
                        href={`/restaurants/${restaurant.id}`}
                        className="text-muted hover:text-primary"
                        aria-label={`Abrir ${restaurant.name}`}
                      >
                        <Icon name="chevronRight" size={14} />
                      </Link>
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </Card>

      {canCreate ? (
        <Card className="mt-4 max-w-[720px] p-5">
          <CardLabel className="mb-3">Nuevo restaurante</CardLabel>
          <form action={createRestaurant} className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre *">
              <input name="name" required className={INPUT} />
            </Field>
            <Field label="Slug *">
              <input name="slug" required pattern="[a-z0-9-]+" className={INPUT} />
            </Field>

            <Field label="Organización *">
              <select name="org_id" required className={INPUT}>
                {scope.organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Patio de comida">
              <select name="food_court_id" className={INPUT} defaultValue="">
                <option value="">Independiente</option>
                {scope.food_courts.map((fc) => (
                  <option key={fc.id} value={fc.id}>
                    {fc.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Dirección">
              <input name="address" className={INPUT} />
            </Field>

            <div className="grid grid-cols-3 gap-2">
              <Field label="Moneda">
                <input name="currency" defaultValue="USD" maxLength={3} className={INPUT} />
              </Field>
              <Field label="IVA">
                <input
                  name="tax_rate"
                  defaultValue="0"
                  inputMode="decimal"
                  title="Proporción, p. ej. 0.07 para 7%"
                  className={INPUT}
                />
              </Field>
              <Field label="Zona horaria">
                <input name="timezone" defaultValue="America/Panama" className={INPUT} />
              </Field>
            </div>

            <div className="sm:col-span-2">
              <Button type="submit">
                <Icon name="plus" size={13} />
                Crear restaurante
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}

const INPUT =
  'w-full rounded-[8px] border border-line bg-surface-container px-3 py-2 text-[13px] text-text-primary outline-none focus:border-primary/40';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <CardLabel className="mb-1.5">{label}</CardLabel>
      {children}
    </label>
  );
}
