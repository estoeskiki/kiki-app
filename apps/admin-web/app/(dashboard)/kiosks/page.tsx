import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { Card, CardLabel, EmptyState, PageHeading } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { TableWrap, TD, TH, TR } from '@/components/ui/Table';
import { IssueTokenForm } from '@/components/kiosks/IssueTokenForm';
import { canAdminister, requireViewer } from '@/lib/auth/dal';
import { getScopeTree } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import { formatAgo, formatDateTime } from '@/lib/format';
import { deleteDevice, setDeviceActive } from './actions';

export const metadata = { title: 'Kioskos · Kiki' };

/**
 * Kiosk fleet health.
 *
 * "Visto por última vez" is device_tokens.last_seen_at, which authenticate_device
 * stamps each time a kiosk pairs or re-authenticates — so it reflects app
 * restarts, not a continuous heartbeat. A kiosk that has been running happily
 * for a week will legitimately show a week-old timestamp; the thresholds below
 * are named for that ("reciente" / "sin señal") rather than pretending to be
 * uptime monitoring.
 */
const LIVE_MS = 24 * 60 * 60 * 1000;
const STALE_MS = 7 * 24 * 60 * 60 * 1000;

function deviceHealth(lastSeen: string | null, now: number) {
  if (!lastSeen) return { tone: 'neutral' as const, label: 'Nunca emparejado' };
  const age = now - new Date(lastSeen).getTime();
  if (age < LIVE_MS) return { tone: 'lime' as const, label: 'Reciente' };
  if (age < STALE_MS) return { tone: 'cyan' as const, label: 'Hace días' };
  return { tone: 'pink' as const, label: 'Sin señal' };
}

export default async function KiosksPage() {
  const viewer = await requireViewer();
  if (!canAdminister(viewer)) notFound();

  const scope = await getScopeTree();
  const supabase = await createClient();

  const { data: devices } = await supabase
    .from('device_tokens')
    .select('id, device_name, token_hash, is_active, last_seen_at, created_at, restaurant_id, food_court_id')
    .order('created_at', { ascending: false });

  const restaurantName = new Map(scope.restaurants.map((r) => [r.id, r.name]));
  const foodCourtName = new Map(scope.food_courts.map((f) => [f.id, f.name]));

  // Reading the clock is exactly what this page is for, and it renders on the
  // server per request — there is no render purity to preserve here, and the
  // React Compiler lint rule that flags Date.now() is aimed at client renders.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  const rows = devices ?? [];
  const counts = rows.reduce(
    (acc, device) => {
      const tone = deviceHealth(device.last_seen_at, now).tone;
      if (tone === 'lime') acc.live += 1;
      else if (tone === 'cyan') acc.stale += 1;
      else acc.dead += 1;
      return acc;
    },
    { live: 0, stale: 0, dead: 0 }
  );

  const canDelete = viewer.is_platform_admin || viewer.role === 'owner';

  return (
    <div className="fade-in px-7 pb-12 pt-6">
      <PageHeading
        title="Kioskos"
        subtitle={`${rows.length} dispositivo${rows.length === 1 ? '' : 's'} registrado${rows.length === 1 ? '' : 's'}`}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <FleetStat label="Vistos hoy" value={counts.live} tone="lime" pulse />
        <FleetStat label="Hace días" value={counts.stale} tone="cyan" />
        <FleetStat label="Sin señal" value={counts.dead} tone="pink" />
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState>Todavía no has emitido ningún token de kiosko.</EmptyState>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <TH>Dispositivo</TH>
                <TH>Emparejado con</TH>
                <TH>Estado</TH>
                <TH>Última señal</TH>
                <TH>Token</TH>
                <TH />
              </tr>
            </thead>
            <tbody>
              {rows.map((device) => {
                const status = deviceHealth(device.last_seen_at, now);
                return (
                  <TR key={device.id}>
                    <TD>
                      <span className="font-heading font-bold tracking-[0.02em] text-tertiary">
                        {device.device_name}
                      </span>
                    </TD>
                    <TD>
                      <span className="text-muted">
                        {device.restaurant_id
                          ? (restaurantName.get(device.restaurant_id) ?? '—')
                          : device.food_court_id
                            ? `${foodCourtName.get(device.food_court_id) ?? '—'} · patio`
                            : '—'}
                      </span>
                    </TD>
                    <TD>
                      <div className="flex gap-1.5">
                        <Badge tone={status.tone}>{status.label}</Badge>
                        {device.is_active ? null : <Badge tone="neutral">Revocado</Badge>}
                      </div>
                    </TD>
                    <TD>
                      <span
                        className="text-muted"
                        title={device.last_seen_at ? formatDateTime(device.last_seen_at) : undefined}
                      >
                        {device.last_seen_at ? formatAgo(device.last_seen_at) : '—'}
                      </span>
                    </TD>
                    <TD>
                      {/* Only the tail: this column is the pairing secret. */}
                      <code className="text-[11px] text-muted">…{device.token_hash.slice(-4)}</code>
                    </TD>
                    <TD>
                      <div className="flex items-center justify-end gap-2">
                        <form action={setDeviceActive}>
                          <input type="hidden" name="id" value={device.id} />
                          <input type="hidden" name="value" value={String(!device.is_active)} />
                          <button
                            type="submit"
                            className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted transition-colors hover:text-text-primary"
                          >
                            {device.is_active ? 'Revocar' : 'Reactivar'}
                          </button>
                        </form>

                        {canDelete ? (
                          <form action={deleteDevice}>
                            <input type="hidden" name="id" value={device.id} />
                            <button
                              type="submit"
                              aria-label={`Eliminar ${device.device_name}`}
                              className="text-muted transition-colors hover:text-secondary"
                            >
                              <Icon name="x" size={13} />
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <Card className="mt-4 max-w-[820px] p-5">
        <CardLabel className="mb-1">Emitir token</CardLabel>
        <p className="mb-4 text-[11px] text-muted">
          Revocar un token impide nuevos emparejamientos con él. Un kiosko ya emparejado conserva su
          sesión hasta que se reinicie la app.
        </p>
        <IssueTokenForm restaurants={scope.restaurants} foodCourts={scope.food_courts} />
      </Card>
    </div>
  );
}

function FleetStat({
  label,
  value,
  tone,
  pulse,
}: {
  label: string;
  value: number;
  tone: 'lime' | 'cyan' | 'pink';
  pulse?: boolean;
}) {
  const dot =
    tone === 'lime' ? 'bg-primary' : tone === 'cyan' ? 'bg-tertiary' : 'bg-secondary';

  return (
    <Card className="flex items-center gap-3.5 px-5 py-4">
      <span
        className={`size-2.5 shrink-0 rounded-full ${dot} ${pulse ? 'pulse-dot' : ''}`}
        aria-hidden
      />
      <div>
        <div className="font-heading text-[28px] font-bold leading-none tracking-[-0.04em] tabular-nums text-text-primary">
          {value}
        </div>
        <div className="mt-0.5 text-[11px] text-muted">{label}</div>
      </div>
    </Card>
  );
}
