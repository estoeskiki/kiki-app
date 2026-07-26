import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardLabel, CardTitle } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { KpiCard } from '@/components/KpiCard';
import { ZonesCard } from '@/components/tenant/ZonesCard';
import { canAdminister, requireViewer } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';
import { parseFilters } from '@/lib/filters';
import { getKpis } from '@/lib/queries';
import { changeRatio, formatMoney, formatNumber, formatPercent } from '@/lib/format';
import { setRestaurantFlag, updateRestaurant } from '../actions';

export const metadata = { title: 'Restaurante · Kiki' };

const INPUT =
  'w-full rounded-[8px] border border-line bg-surface-container px-3 py-2 text-[13px] text-text-primary outline-none focus:border-primary/40';

export default async function RestaurantDetailPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const viewer = await requireViewer();
  const { restaurantId } = await params;

  const supabase = await createClient();

  // No scope predicate: RLS already limits `restaurants` to what this viewer
  // may see, so an id outside their scope returns nothing and 404s.
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .eq('id', restaurantId)
    .maybeSingle();

  if (!restaurant) notFound();

  const [{ data: foodCourt }, { data: zones }, kpis] = await Promise.all([
    restaurant.food_court_id
      ? supabase.from('food_courts').select('id, name').eq('id', restaurant.food_court_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('tables')
      .select('id, label, is_active, allows_manual_number, qr_token')
      .eq('restaurant_id', restaurant.id)
      .order('label'),
    getKpis(parseFilters({ range: '30d', r: restaurant.id })),
  ]);

  const administers = canAdminister(viewer);

  return (
    <div className="fade-in px-7 pb-12 pt-6">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/restaurants"
          className="flex items-center gap-1 text-[12px] text-muted hover:text-text-primary"
        >
          <Icon name="chevronLeft" size={13} />
          Restaurantes
        </Link>
        <span className="text-line-strong" aria-hidden>
          |
        </span>
        <h1 className="font-heading text-[20px] font-bold tracking-[-0.04em] text-text-primary">
          {restaurant.name}
        </h1>
        <Badge tone={restaurant.is_open ? 'lime' : 'neutral'}>
          {restaurant.is_open ? 'Abierto' : 'Cerrado'}
        </Badge>
        {restaurant.is_active ? null : <Badge tone="pink">Oculto</Badge>}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="Ingresos (30 d)"
          value={formatMoney(kpis.current.revenue_cents, restaurant.currency)}
          change={changeRatio(kpis.current.revenue_cents, kpis.previous.revenue_cents)}
        />
        <KpiCard
          label="Pedidos (30 d)"
          value={formatNumber(kpis.current.orders)}
          change={changeRatio(kpis.current.orders, kpis.previous.orders)}
        />
        <KpiCard
          label="Cancelaciones"
          value={formatPercent(kpis.current.cancel_rate)}
          change={changeRatio(kpis.current.cancel_rate, kpis.previous.cancel_rate)}
          goodWhenUp={false}
        />
      </div>

      <div className="grid gap-3.5 xl:grid-cols-[1.3fr_1fr]">
        <Card className="p-5">
          <CardTitle className="mb-4">Detalles</CardTitle>

          {administers ? (
            <form action={updateRestaurant} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="id" value={restaurant.id} />

              <Field label="Nombre">
                <input name="name" required defaultValue={restaurant.name} className={INPUT} />
              </Field>
              <Field label="Dirección">
                <input name="address" defaultValue={restaurant.address ?? ''} className={INPUT} />
              </Field>
              <Field label="Eslogan">
                <input name="slogan" defaultValue={restaurant.slogan ?? ''} className={INPUT} />
              </Field>
              <Field label="Zona horaria">
                <input name="timezone" defaultValue={restaurant.timezone} className={INPUT} />
              </Field>
              <Field label="Moneda">
                <input name="currency" maxLength={3} defaultValue={restaurant.currency} className={INPUT} />
              </Field>
              <Field label="IVA (proporción)">
                <input
                  name="tax_rate"
                  inputMode="decimal"
                  defaultValue={String(restaurant.tax_rate)}
                  className={INPUT}
                />
              </Field>
              <Field label="Logo (URL)">
                <input name="logo_url" type="url" defaultValue={restaurant.logo_url ?? ''} className={INPUT} />
              </Field>
              <Field label="Fondo de bienvenida (URL)">
                <input
                  name="welcome_bg_url"
                  type="url"
                  defaultValue={restaurant.welcome_bg_url ?? ''}
                  className={INPUT}
                />
              </Field>

              <div className="sm:col-span-2">
                <Button type="submit">Guardar cambios</Button>
              </div>
            </form>
          ) : (
            <dl className="text-[12px]">
              <Detail label="Slug" value={`/${restaurant.slug}`} />
              <Detail label="Dirección" value={restaurant.address ?? '—'} />
              <Detail label="Patio de comida" value={foodCourt?.name ?? 'Independiente'} />
              <Detail label="Zona horaria" value={restaurant.timezone} />
              <Detail label="Moneda" value={restaurant.currency} />
            </dl>
          )}
        </Card>

        <div className="flex flex-col gap-3.5">
          <Card className="p-5">
            <CardTitle className="mb-1">Estado</CardTitle>
            <CardLabel className="mb-4">
              «Abierto» es la operación diaria; «Publicado» controla si la tienda existe para el
              público
            </CardLabel>

            <div className="flex flex-col gap-2.5">
              <ToggleRow
                id={restaurant.id}
                field="is_open"
                value={restaurant.is_open}
                label="Aceptando pedidos"
                disabled={!administers}
              />
              <ToggleRow
                id={restaurant.id}
                field="is_active"
                value={restaurant.is_active}
                label="Publicado"
                disabled={!administers || (!viewer.is_platform_admin && viewer.role !== 'owner')}
              />
            </div>

            <dl className="mt-4 border-t border-line pt-3 text-[12px]">
              <Detail label="Patio de comida" value={foodCourt?.name ?? 'Independiente'} />
              <Detail label="Slug público" value={`/${restaurant.slug}`} />
            </dl>
          </Card>

          <ZonesCard
            zones={zones ?? []}
            restaurantId={restaurant.id}
            canEdit={administers}
            title="Zonas del restaurante"
            hint="Mesas con QR propio de este local."
          />
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  id,
  field,
  value,
  label,
  disabled,
}: {
  id: string;
  field: 'is_open' | 'is_active';
  value: boolean;
  label: string;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13px] text-text-primary">{label}</span>
      {disabled ? (
        <Badge tone={value ? 'lime' : 'neutral'}>{value ? 'Sí' : 'No'}</Badge>
      ) : (
        <form action={setRestaurantFlag}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="field" value={field} />
          <input type="hidden" name="value" value={String(!value)} />
          <button type="submit" aria-pressed={value} className="cursor-pointer">
            <Badge tone={value ? 'lime' : 'neutral'}>{value ? 'Sí' : 'No'}</Badge>
          </button>
        </form>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <CardLabel className="mb-1.5">{label}</CardLabel>
      {children}
    </label>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-2 last:border-b-0">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="truncate text-right font-semibold text-text-primary">{value}</dd>
    </div>
  );
}
