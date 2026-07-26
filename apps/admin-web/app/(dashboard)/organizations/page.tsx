import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardLabel, EmptyState, PageHeading } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { requirePlatformAdmin } from '@/lib/auth/dal';
import { getScopeTree } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import { addDays, formatMoney, formatNumber, startOfLocalDay } from '@/lib/format';
import { createOrganization } from '../restaurants/actions';

export const metadata = { title: 'Organizaciones · Kiki' };

const INPUT =
  'w-full rounded-[8px] border border-line bg-surface-container px-3 py-2 text-[13px] text-text-primary outline-none focus:border-primary/40';

/**
 * Platform-operator view of every tenant.
 *
 * requirePlatformAdmin() gates the route, and the underlying `organizations`
 * policies only expose other tenants' rows to is_platform_admin() — so a
 * non-operator reaching this URL directly sees a redirect, not a filtered page.
 */
export default async function OrganizationsPage() {
  await requirePlatformAdmin();

  const scope = await getScopeTree();
  const from = addDays(startOfLocalDay(new Date()), -30);

  const supabase = await createClient();
  const { data: factRows } = await supabase
    .from('dashboard_order_facts')
    .select('org_id, order_id, total, status')
    .gte('created_at', from.toISOString());

  const stats = new Map<string, { revenue: number; orderIds: Set<string> }>();
  for (const row of factRows ?? []) {
    if (row.status === 'cancelled' || !row.org_id) continue;
    const entry = stats.get(row.org_id) ?? { revenue: 0, orderIds: new Set<string>() };
    entry.revenue += row.total ?? 0;
    if (row.order_id) entry.orderIds.add(row.order_id);
    stats.set(row.org_id, entry);
  }

  return (
    <div className="fade-in px-7 pb-12 pt-6">
      <PageHeading
        title="Organizaciones"
        subtitle={`${scope.organizations.length} org${scope.organizations.length === 1 ? '' : 's'} · ${scope.restaurants.length} restaurantes en total`}
      />

      {scope.organizations.length === 0 ? (
        <Card>
          <EmptyState>Todavía no hay organizaciones.</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          {scope.organizations.map((org) => {
            const branches = scope.restaurants.filter((r) => r.org_id === org.id);
            const stat = stats.get(org.id) ?? { revenue: 0, orderIds: new Set<string>() };

            return (
              <Card key={org.id} className="p-5">
                <div className="mb-4">
                  <div className="font-heading text-[15px] font-bold tracking-[-0.03em] text-text-primary">
                    {org.name}
                  </div>
                  <div className="mt-1 text-[11px] text-muted">/{org.slug}</div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <Stat label="Sucursales" value={formatNumber(branches.length)} />
                  <Stat label="Pedidos (30 d)" value={formatNumber(stat.orderIds.size)} />
                  <Stat label="Ingresos (30 d)" value={formatMoney(stat.revenue)} accent />
                  <Stat
                    label="Activas"
                    value={formatNumber(branches.filter((b) => b.is_active).length)}
                  />
                </div>

                {branches.length > 0 ? (
                  <div className="mt-3.5 flex flex-wrap gap-1.5">
                    {branches.slice(0, 6).map((branch) => (
                      <Link
                        key={branch.id}
                        href={`/restaurants/${branch.id}`}
                        className="rounded-[5px] bg-surface-container px-2 py-[3px] text-[10px] font-semibold text-muted transition-colors hover:text-primary"
                      >
                        {branch.name}
                      </Link>
                    ))}
                    {branches.length > 6 ? (
                      <span className="px-1 py-[3px] text-[10px] text-muted">
                        +{branches.length - 6}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      <Card className="mt-4 max-w-[560px] p-5">
        <CardLabel className="mb-3">Registrar organización</CardLabel>
        <form action={createOrganization} className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <CardLabel className="mb-1.5">Nombre *</CardLabel>
            <input name="name" required className={INPUT} />
          </label>
          <label className="block">
            <CardLabel className="mb-1.5">Slug *</CardLabel>
            <input name="slug" required pattern="[a-z0-9-]+" className={INPUT} />
          </label>
          <div className="sm:col-span-2">
            <Button type="submit">
              <Icon name="plus" size={13} />
              Crear organización
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-[8px] bg-surface-container px-3 py-2.5">
      <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.08em] text-muted">{label}</div>
      <div
        className={`font-heading text-[16px] font-bold tracking-[-0.03em] tabular-nums ${
          accent ? 'text-primary' : 'text-text-primary'
        }`}
      >
        {value}
      </div>
    </div>
  );
}
