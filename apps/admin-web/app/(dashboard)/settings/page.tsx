import { Badge, RoleBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardLabel, CardTitle, EmptyState, PageHeading } from '@/components/ui/Card';
import { RestaurantPicker } from '@/components/RestaurantPicker';
import { canAdminister, requireViewer } from '@/lib/auth/dal';
import { getScopeTree } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import type { SearchParams } from '@/lib/filters';
import { updateRestaurant } from '../restaurants/actions';

export const metadata = { title: 'Ajustes · Kiki' };

const INPUT =
  'w-full rounded-[8px] border border-line bg-surface-container px-3 py-2 text-[13px] text-text-primary outline-none focus:border-primary/40';

/**
 * Per-restaurant identity and branding — the assets the kiosk and the public
 * storefront render.
 *
 * Images are taken as URLs rather than uploaded here: logo_url and
 * welcome_bg_url are plain text columns consumed by apps/kiosk and
 * apps/order-web, and adding a Storage bucket would mean a bucket policy, a
 * signed-upload flow, and a second place for these assets to live. Point them
 * at wherever the brand assets already are.
 */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await requireViewer();
  const params = await searchParams;
  const scope = await getScopeTree();

  const requested = typeof params.r === 'string' ? params.r : undefined;
  const selected = scope.restaurants.find((r) => r.id === requested) ?? scope.restaurants[0] ?? null;

  const supabase = await createClient();
  const { data: restaurant } = selected
    ? await supabase.from('restaurants').select('*').eq('id', selected.id).maybeSingle()
    : { data: null };

  const administers = canAdminister(viewer);

  return (
    <div className="fade-in px-7 pb-12 pt-6">
      <PageHeading
        title="Ajustes"
        subtitle={restaurant ? restaurant.name : undefined}
        actions={
          selected ? (
            <RestaurantPicker restaurants={scope.restaurants} value={selected.id} />
          ) : null
        }
      />

      <div className="grid max-w-[1000px] gap-3.5 lg:grid-cols-2">
        {!restaurant ? (
          <Card>
            <EmptyState>No tienes restaurantes asignados.</EmptyState>
          </Card>
        ) : (
          <>
            <Card className="p-5">
              <CardTitle className="mb-4">Restaurante</CardTitle>

              {administers ? (
                <form action={updateRestaurant} className="flex flex-col gap-3">
                  <input type="hidden" name="id" value={restaurant.id} />

                  <Field label="Nombre">
                    <input name="name" required defaultValue={restaurant.name} className={INPUT} />
                  </Field>
                  <Field label="Eslogan">
                    <input name="slogan" defaultValue={restaurant.slogan ?? ''} className={INPUT} />
                  </Field>
                  <Field label="Dirección">
                    <input name="address" defaultValue={restaurant.address ?? ''} className={INPUT} />
                  </Field>

                  <div className="grid grid-cols-3 gap-2">
                    <Field label="Moneda">
                      <input
                        name="currency"
                        maxLength={3}
                        defaultValue={restaurant.currency}
                        className={INPUT}
                      />
                    </Field>
                    <Field label="IVA">
                      <input
                        name="tax_rate"
                        inputMode="decimal"
                        title="Proporción, p. ej. 0.07 para 7%"
                        defaultValue={String(restaurant.tax_rate)}
                        className={INPUT}
                      />
                    </Field>
                    <Field label="Zona horaria">
                      <input name="timezone" defaultValue={restaurant.timezone} className={INPUT} />
                    </Field>
                  </div>

                  <CardLabel className="mt-1">Marca</CardLabel>
                  <Field label="Logo (URL)">
                    <input
                      name="logo_url"
                      type="url"
                      placeholder="https://…"
                      defaultValue={restaurant.logo_url ?? ''}
                      className={INPUT}
                    />
                  </Field>
                  <Field label="Fondo de bienvenida (URL)">
                    <input
                      name="welcome_bg_url"
                      type="url"
                      placeholder="https://…"
                      defaultValue={restaurant.welcome_bg_url ?? ''}
                      className={INPUT}
                    />
                  </Field>

                  <div>
                    <Button type="submit">Guardar cambios</Button>
                  </div>
                </form>
              ) : (
                <p className="text-[12px] text-muted">
                  Tu rol permite ver estos ajustes pero no modificarlos.
                </p>
              )}
            </Card>

            <div className="flex flex-col gap-3.5">
              <Card className="p-5">
                <CardTitle className="mb-4">Tu cuenta</CardTitle>
                <Row label="Correo" value={viewer.email} />
                <Row label="Nombre" value={viewer.display_name ?? '—'} />
                <div className="flex items-baseline justify-between gap-3 border-b border-line py-2">
                  <span className="text-[12px] text-muted">Rol</span>
                  <RoleBadge role={viewer.role} isPlatformAdmin={viewer.is_platform_admin} />
                </div>
                <Row
                  label="Restaurantes"
                  value={String(viewer.restaurant_ids.length)}
                />
                {viewer.food_court_ids.length > 0 ? (
                  <Row label="Patios de comida" value={String(viewer.food_court_ids.length)} />
                ) : null}
                <p className="mt-3 text-[11px] text-muted">
                  Estas credenciales son las mismas que usas en la app de administración.
                </p>
              </Card>

              <Card className="p-5">
                <CardTitle className="mb-1">Vista pública</CardTitle>
                <CardLabel className="mb-3">Cómo aparece este local a los clientes</CardLabel>
                <Row label="Slug" value={`/${restaurant.slug}`} />
                <div className="flex items-baseline justify-between gap-3 border-b border-line py-2">
                  <span className="text-[12px] text-muted">Publicado</span>
                  <Badge tone={restaurant.is_active ? 'lime' : 'pink'}>
                    {restaurant.is_active ? 'Sí' : 'Oculto'}
                  </Badge>
                </div>
                <div className="flex items-baseline justify-between gap-3 py-2">
                  <span className="text-[12px] text-muted">Aceptando pedidos</span>
                  <Badge tone={restaurant.is_open ? 'lime' : 'neutral'}>
                    {restaurant.is_open ? 'Sí' : 'No'}
                  </Badge>
                </div>
                <p className="mt-2 text-[11px] text-muted">
                  Ambos se cambian desde la ficha del restaurante.
                </p>
              </Card>
            </div>
          </>
        )}
      </div>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-2 last:border-b-0">
      <span className="shrink-0 text-[12px] text-muted">{label}</span>
      <span className="truncate text-right text-[12px] font-semibold text-text-primary">{value}</span>
    </div>
  );
}
