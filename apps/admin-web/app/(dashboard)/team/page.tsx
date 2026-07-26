import { notFound } from 'next/navigation';
import { Badge, RoleBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardLabel, EmptyState, PageHeading } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { TableWrap, TD, TH, TR } from '@/components/ui/Table';
import { canAdminister, requireViewer } from '@/lib/auth/dal';
import { getScopeTree } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import { inviteMember, removeMember, updateMemberRole } from './actions';

export const metadata = { title: 'Equipo · Kiki' };

const INPUT =
  'w-full rounded-[8px] border border-line bg-surface-container px-3 py-2 text-[13px] text-text-primary outline-none focus:border-primary/40';

type Member = {
  id: string;
  user_id: string;
  role: string;
  display_name: string | null;
  created_at: string;
  table: 'org_members' | 'food_court_members';
  scopeLabel: string;
};

/**
 * People with access.
 *
 * Two membership tables feed this: org_members (restaurant staff and org
 * owners) and food_court_members (venue-wide staff). RLS returns only the rows
 * in the viewer's scope, so a restaurant owner sees their org's people and a
 * platform admin sees everyone.
 *
 * kiosk_device rows are paired hardware, not people, and are filtered out —
 * they belong on the Kioskos page.
 */
export default async function TeamPage() {
  const viewer = await requireViewer();
  if (!canAdminister(viewer)) notFound();

  const scope = await getScopeTree();
  const supabase = await createClient();

  const [{ data: orgMembers }, { data: foodCourtMembers }] = await Promise.all([
    supabase
      .from('org_members')
      .select('id, user_id, role, display_name, created_at, org_id, restaurant_id')
      .order('created_at'),
    supabase
      .from('food_court_members')
      .select('id, user_id, role, display_name, created_at, food_court_id')
      .order('created_at'),
  ]);

  const restaurantName = new Map(scope.restaurants.map((r) => [r.id, r.name]));
  const orgName = new Map(scope.organizations.map((o) => [o.id, o.name]));
  const foodCourtName = new Map(scope.food_courts.map((f) => [f.id, f.name]));

  const members: Member[] = [
    ...(orgMembers ?? [])
      .filter((m) => m.role !== 'kiosk_device')
      .map((m) => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        display_name: m.display_name,
        created_at: m.created_at,
        table: 'org_members' as const,
        scopeLabel: m.restaurant_id
          ? (restaurantName.get(m.restaurant_id) ?? 'Restaurante')
          : `${orgName.get(m.org_id) ?? 'Organización'} · toda la org`,
      })),
    ...(foodCourtMembers ?? [])
      .filter((m) => m.role !== 'kiosk_device')
      .map((m) => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        display_name: m.display_name,
        created_at: m.created_at,
        table: 'food_court_members' as const,
        scopeLabel: `${foodCourtName.get(m.food_court_id) ?? 'Patio'} · todo el patio`,
      })),
  ];

  return (
    <div className="fade-in px-7 pb-12 pt-6">
      <PageHeading
        title="Equipo"
        subtitle={`${members.length} miembro${members.length === 1 ? '' : 's'} con acceso`}
      />

      <Card>
        {members.length === 0 ? (
          <EmptyState>Todavía no hay miembros en tu alcance.</EmptyState>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <TH>Miembro</TH>
                <TH>Rol</TH>
                <TH>Alcance</TH>
                <TH>Cambiar rol</TH>
                <TH />
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <TR key={`${member.table}-${member.id}`}>
                  <TD>
                    <div className="flex items-center gap-2.5">
                      <div
                        className="flex size-8 shrink-0 items-center justify-center rounded-full font-heading text-[10px] font-extrabold text-on-primary"
                        style={{
                          background:
                            'linear-gradient(135deg, var(--color-primary), var(--color-tertiary))',
                        }}
                        aria-hidden
                      >
                        {(member.display_name ?? '?').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-text-primary">
                          {member.display_name ?? 'Sin nombre'}
                        </div>
                        {member.user_id === viewer.user_id ? (
                          <span className="text-[10px] text-muted">tú</span>
                        ) : null}
                      </div>
                    </div>
                  </TD>
                  <TD>
                    <RoleBadge role={member.role} />
                  </TD>
                  <TD>
                    <span className="text-muted">{member.scopeLabel}</span>
                  </TD>
                  <TD>
                    <form action={updateMemberRole} className="flex items-center gap-1.5">
                      <input type="hidden" name="id" value={member.id} />
                      <input type="hidden" name="table" value={member.table} />
                      <select
                        name="role"
                        defaultValue={member.role}
                        className="rounded-[7px] border border-line bg-surface-container px-2 py-1 text-[12px] text-text-primary outline-none focus:border-primary/40"
                      >
                        <option value="owner">Propietario</option>
                        <option value="manager">Gerente</option>
                        <option value="staff">Personal</option>
                      </select>
                      <Button type="submit" size="sm" variant="outline">
                        <Icon name="check" size={11} />
                      </Button>
                    </form>
                  </TD>
                  <TD>
                    {member.user_id === viewer.user_id ? (
                      <Badge tone="neutral">—</Badge>
                    ) : (
                      <form action={removeMember}>
                        <input type="hidden" name="id" value={member.id} />
                        <input type="hidden" name="table" value={member.table} />
                        <input type="hidden" name="user_id" value={member.user_id} />
                        <button
                          type="submit"
                          aria-label="Quitar miembro"
                          className="text-muted transition-colors hover:text-secondary"
                        >
                          <Icon name="x" size={13} />
                        </button>
                      </form>
                    )}
                  </TD>
                </TR>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <Card className="mt-4 max-w-[820px] p-5">
        <CardLabel className="mb-1">Invitar miembro</CardLabel>
        <p className="mb-4 text-[11px] text-muted">
          Se crea la cuenta con la contraseña que definas y el usuario podrá entrar de inmediato,
          aquí y en la app de administración. Compártela por un canal seguro y pídele que la cambie.
        </p>

        <form action={inviteMember} className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <CardLabel className="mb-1.5">Correo *</CardLabel>
            <input name="email" type="email" required autoComplete="off" className={INPUT} />
          </label>

          <label className="block">
            <CardLabel className="mb-1.5">Nombre</CardLabel>
            <input name="display_name" autoComplete="off" className={INPUT} />
          </label>

          <label className="block">
            <CardLabel className="mb-1.5">Contraseña temporal * (mín. 12)</CardLabel>
            <input
              name="password"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              className={INPUT}
            />
          </label>

          <label className="block">
            <CardLabel className="mb-1.5">Rol *</CardLabel>
            <select name="role" required defaultValue="staff" className={INPUT}>
              <option value="staff">Personal</option>
              <option value="manager">Gerente</option>
              <option value="owner">Propietario</option>
            </select>
          </label>

          <label className="block sm:col-span-2">
            <CardLabel className="mb-1.5">Alcance *</CardLabel>
            <select name="scope" required className={INPUT}>
              {viewer.is_platform_admin
                ? scope.organizations.map((org) => (
                    <option key={org.id} value={`org:${org.id}`}>
                      {org.name} · toda la organización
                    </option>
                  ))
                : null}
              {scope.restaurants.map((restaurant) => (
                <option key={restaurant.id} value={`restaurant:${restaurant.id}`}>
                  {restaurant.name}
                </option>
              ))}
              {scope.food_courts.map((foodCourt) => (
                <option key={foodCourt.id} value={`foodcourt:${foodCourt.id}`}>
                  {foodCourt.name} · todo el patio
                </option>
              ))}
            </select>
          </label>

          <div className="sm:col-span-2">
            <Button type="submit">
              <Icon name="plus" size={13} />
              Crear cuenta
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
