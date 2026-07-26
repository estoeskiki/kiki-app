'use client';

import { useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CheckRow, Popover, PopoverGroupLabel } from '@/components/filters/Popover';
import { Icon } from '@/components/ui/Icon';
import {
  ORDER_CHANNELS,
  ORDER_STATUSES,
  RANGE_PRESETS,
  UNZONED,
  buildQuery,
  toggleToken,
} from '@/lib/filters';
import { channelLabel, statusLabel } from '@/components/ui/Badge';
import type { ScopeTree } from '@/lib/types';

const RANGE_LABEL: Record<string, string> = {
  hoy: 'Hoy',
  '7d': '7 días',
  '30d': '30 días',
  '90d': '90 días',
};

/**
 * The dashboard's single filter surface: date range × scope × channel × zone ×
 * status.
 *
 * All state is the URL. Every control rewrites the query string and lets the
 * server re-render, which keeps views shareable and means there is no client
 * cache that can disagree with what was actually queried. Updates run inside a
 * transition so the bar stays interactive while the page streams.
 *
 * `scope` comes from dashboard_scope_tree(), which only returns scopes RLS
 * already permits — the UI cannot offer a filter the viewer would be denied.
 */
export function FilterBar({
  scope,
  showStatus = true,
}: {
  scope: ScopeTree;
  showStatus?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const patch = (next: Record<string, string | string[] | null>) => {
    startTransition(() => {
      router.replace(`${pathname}${buildQuery(params, next)}`, { scroll: false });
    });
  };

  const get = (key: string) => params.get(key);
  const tokens = (key: string) =>
    (get(key) ?? '').split(',').map((s) => s.trim()).filter(Boolean);

  const range = get('range') ?? '7d';
  const isCustom = Boolean(get('from') && get('to'));

  const orgIds = tokens('org');
  const fcIds = tokens('fc');
  const restaurantIds = tokens('r');
  const zoneTokens = tokens('zone');
  const channels = tokens('channel');
  const statuses = tokens('status');

  const scopeCount = orgIds.length + fcIds.length + restaurantIds.length;
  const scopeSummary =
    scopeCount === 0
      ? 'Todo'
      : restaurantIds.length === 1 && scopeCount === 1
        ? (scope.restaurants.find((r) => r.id === restaurantIds[0])?.name ?? '1 seleccionado')
        : `${scopeCount} seleccionados`;

  const zoneSummary =
    zoneTokens.length === 0
      ? 'Todas'
      : zoneTokens.length === 1
        ? zoneTokens[0] === UNZONED
          ? 'Sin zona'
          : (scope.zones.find((z) => z.id === zoneTokens[0])?.label ?? '1 zona')
        : `${zoneTokens.length} zonas`;

  const hasAnyFilter =
    scopeCount + zoneTokens.length + channels.length + statuses.length > 0 || isCustom;

  return (
    <div
      className={`sticky top-0 z-40 flex flex-wrap items-center gap-2 border-b border-line bg-background/95 px-7 py-3 backdrop-blur transition-opacity ${
        pending ? 'opacity-60' : ''
      }`}
    >
      {/* Date range */}
      <div className="flex items-center gap-1">
        {RANGE_PRESETS.map((preset) => {
          const active = !isCustom && range === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => patch({ range: preset, from: null, to: null })}
              className={`rounded-[8px] border px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.06em] transition-colors ${
                active
                  ? 'border-primary/35 bg-primary/10 text-primary'
                  : 'border-line text-muted hover:text-text-primary'
              }`}
            >
              {RANGE_LABEL[preset]}
            </button>
          );
        })}

        <label className="ml-1 flex items-center gap-1 rounded-[8px] border border-line px-2 py-1">
          <span className="sr-only">Desde</span>
          <input
            type="date"
            value={get('from') ?? ''}
            max={get('to') ?? undefined}
            onChange={(e) => patch({ from: e.target.value || null })}
            className="bg-transparent text-[11px] text-muted outline-none"
          />
          <span className="text-muted">–</span>
          <span className="sr-only">Hasta</span>
          <input
            type="date"
            value={get('to') ?? ''}
            min={get('from') ?? undefined}
            onChange={(e) => patch({ to: e.target.value || null })}
            className="bg-transparent text-[11px] text-muted outline-none"
          />
        </label>
      </div>

      <span className="h-4 w-px bg-line" aria-hidden />

      {/* Scope: organization -> food court -> restaurant */}
      <Popover label="Ámbito" summary={scopeSummary} count={scopeCount}>
        {scope.organizations.length > 1 ? (
          <>
            <PopoverGroupLabel>Organizaciones</PopoverGroupLabel>
            {scope.organizations.map((org) => (
              <CheckRow
                key={org.id}
                checked={orgIds.includes(org.id)}
                onChange={() => patch({ org: toggleToken(get('org'), org.id) })}
              >
                {org.name}
              </CheckRow>
            ))}
          </>
        ) : null}

        {scope.food_courts.length > 0 ? (
          <>
            <PopoverGroupLabel>Patios de comida</PopoverGroupLabel>
            {scope.food_courts.map((fc) => (
              <CheckRow
                key={fc.id}
                checked={fcIds.includes(fc.id)}
                onChange={() => patch({ fc: toggleToken(get('fc'), fc.id) })}
              >
                {fc.name}
              </CheckRow>
            ))}
          </>
        ) : null}

        <PopoverGroupLabel>Restaurantes</PopoverGroupLabel>
        {scope.restaurants.map((restaurant) => (
          <CheckRow
            key={restaurant.id}
            checked={restaurantIds.includes(restaurant.id)}
            onChange={() => patch({ r: toggleToken(get('r'), restaurant.id) })}
          >
            {restaurant.name}
            {restaurant.is_active ? '' : ' · oculto'}
          </CheckRow>
        ))}
      </Popover>

      {/* Zone — a zone is a row in `tables`: Sala VIP, Palco #1, Mesa 5. */}
      <Popover label="Zona" summary={zoneSummary} count={zoneTokens.length}>
        <CheckRow
          checked={zoneTokens.includes(UNZONED)}
          onChange={() => patch({ zone: toggleToken(get('zone'), UNZONED) })}
        >
          Sin zona
        </CheckRow>
        {scope.zones.map((zone) => (
          <CheckRow
            key={zone.id}
            checked={zoneTokens.includes(zone.id)}
            onChange={() => patch({ zone: toggleToken(get('zone'), zone.id) })}
          >
            {zone.label}
          </CheckRow>
        ))}
      </Popover>

      {/* Channel — kiosk vs order-web */}
      <div className="flex items-center gap-1">
        {ORDER_CHANNELS.map((channel) => {
          const active = channels.includes(channel);
          return (
            <button
              key={channel}
              type="button"
              onClick={() => patch({ channel: toggleToken(get('channel'), channel) })}
              className={`rounded-[8px] border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                active
                  ? channel === 'kiosk'
                    ? 'border-primary/35 bg-primary/10 text-primary'
                    : 'border-tertiary/35 bg-tertiary/10 text-tertiary'
                  : 'border-line text-muted hover:text-text-primary'
              }`}
            >
              {channelLabel(channel)}
            </button>
          );
        })}
      </div>

      {showStatus ? (
        <Popover
          label="Estado"
          summary={statuses.length ? `${statuses.length} estados` : 'Todos'}
          count={statuses.length}
        >
          {ORDER_STATUSES.map((status) => (
            <CheckRow
              key={status}
              checked={statuses.includes(status)}
              onChange={() => patch({ status: toggleToken(get('status'), status) })}
            >
              {statusLabel(status)}
            </CheckRow>
          ))}
        </Popover>
      ) : null}

      {hasAnyFilter ? (
        <button
          type="button"
          onClick={() =>
            patch({ org: null, fc: null, r: null, zone: null, channel: null, status: null, from: null, to: null })
          }
          className="ml-auto flex items-center gap-1 text-[11px] text-muted transition-colors hover:text-secondary"
        >
          <Icon name="x" size={11} />
          Limpiar
        </button>
      ) : null}
    </div>
  );
}
