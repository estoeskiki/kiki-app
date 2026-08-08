'use client';

import { useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FilterMenu, type MenuGroup } from '@/components/filters/FilterMenu';
import { Segmented } from '@/components/filters/Segmented';
import { Icon } from '@/components/ui/Icon';
import { CONTENT_WIDTH } from '@/components/ui/Container';
import { ORDER_CHANNELS, ORDER_STATUSES, UNZONED, buildQuery, toggleToken } from '@/lib/filters';
import { channelLabel, statusLabel } from '@/components/ui/Badge';
import type { ScopeTree } from '@/lib/types';

const RANGE_OPTIONS = [
  { value: 'hoy', label: 'Hoy' },
  { value: '7d', label: '7D', title: 'Últimos 7 días' },
  { value: '30d', label: '30D', title: 'Últimos 30 días' },
  { value: '90d', label: '90D', title: 'Últimos 90 días' },
] as const;

/**
 * The dashboard's single filter surface: date range × scope × zone × channel ×
 * status.
 *
 * All state is the URL, so views are shareable, back/forward work, and no client
 * store can disagree with what was actually queried. Updates run in a transition
 * so the bar stays responsive while the page streams.
 *
 * Hierarchy is intentional: the date range is a segmented control on the left
 * (one setting, four states), the dimension filters are quiet text triggers that
 * only tint once applied, and the reset sits far right. Nothing carries a border
 * at rest — an unused filter should look available, not applied.
 *
 * `scope` comes from dashboard_scope_tree(), which only returns scopes RLS
 * permits, so this cannot offer a filter the viewer would be denied.
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

  const isCustom = Boolean(get('from') && get('to'));
  const range = isCustom
    ? null
    : ((get('range') ?? '7d') as (typeof RANGE_OPTIONS)[number]['value']);

  // Scope spans three tables, so the menu reports one combined selection and
  // each toggle is routed back to the param its id belongs to.
  const orgIds = tokens('org');
  const fcIds = tokens('fc');
  const restaurantIds = tokens('r');
  const scopeSelected = [...orgIds, ...fcIds, ...restaurantIds];

  const scopeGroups: MenuGroup[] = [
    ...(scope.organizations.length > 1
      ? [
          {
            label: 'Organizaciones',
            options: scope.organizations.map((o) => ({ id: o.id, label: o.name })),
          },
        ]
      : []),
    ...(scope.food_courts.length > 0
      ? [
          {
            label: 'Patios de comida',
            options: scope.food_courts.map((f) => ({ id: f.id, label: f.name })),
          },
        ]
      : []),
    {
      label: 'Restaurantes',
      options: scope.restaurants.map((r) => ({
        id: r.id,
        label: r.name,
        hint: r.is_active ? undefined : 'oculto',
      })),
    },
  ];

  const toggleScope = (id: string) => {
    if (scope.organizations.some((o) => o.id === id)) patch({ org: toggleToken(get('org'), id) });
    else if (scope.food_courts.some((f) => f.id === id)) patch({ fc: toggleToken(get('fc'), id) });
    else patch({ r: toggleToken(get('r'), id) });
  };

  const zoneTokens = tokens('zone');
  const channels = tokens('channel');
  const statuses = tokens('status');

  const activeCount = scopeSelected.length + zoneTokens.length + channels.length + statuses.length;

  return (
    <div className="sticky top-0 z-40 border-b border-line bg-background/80 backdrop-blur-xl">
      <div className={`flex flex-wrap items-center gap-x-1 gap-y-2 py-3 ${CONTENT_WIDTH}`}>
        <Segmented
          ariaLabel="Rango de fechas"
          value={range}
          onChange={(value) => patch({ range: value, from: null, to: null })}
          options={[...RANGE_OPTIONS]}
        />

        {isCustom ? (
          <div className="ml-1 flex items-center gap-1.5 rounded-sm bg-primary/10 px-2.5 py-1.5">
            <input
              type="date"
              aria-label="Desde"
              value={get('from') ?? ''}
              max={get('to') ?? undefined}
              onChange={(e) => patch({ from: e.target.value || null })}
              className="bg-transparent text-xs tabular-nums text-primary outline-none focus-visible:outline-none"
            />
            <span className="text-primary/50" aria-hidden>
              →
            </span>
            <input
              type="date"
              aria-label="Hasta"
              value={get('to') ?? ''}
              min={get('from') ?? undefined}
              onChange={(e) => patch({ to: e.target.value || null })}
              className="bg-transparent text-xs tabular-nums text-primary outline-none focus-visible:outline-none"
            />
            <button
              type="button"
              onClick={() => patch({ from: null, to: null, range: '7d' })}
              aria-label="Quitar rango personalizado"
              className="cursor-pointer text-primary/60 transition-colors hover:text-secondary"
            >
              <Icon name="x" size={11} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              const today = new Date();
              const weekAgo = new Date(today.getTime() - 6 * 86_400_000);
              patch({
                from: weekAgo.toISOString().slice(0, 10),
                to: today.toISOString().slice(0, 10),
              });
            }}
            className="ml-1 cursor-pointer rounded-sm px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors duration-200 hover:bg-surface-container hover:text-text-primary"
          >
            Personalizado
          </button>
        )}

        <span className="mx-2 h-4 w-px bg-line" aria-hidden />

        <FilterMenu
          label="Ámbito"
          groups={scopeGroups}
          selected={scopeSelected}
          onToggle={toggleScope}
          onClear={() => patch({ org: null, fc: null, r: null })}
          width={280}
        />

        {/* A zone is a row in `tables`: Sala VIP, Palco #1, Mesa 5. */}
        <FilterMenu
          label="Zona"
          groups={[
            {
              options: [
                ...scope.zones.map((z) => ({ id: z.id, label: z.label })),
                { id: UNZONED, label: 'Sin zona' },
              ],
            },
          ]}
          selected={zoneTokens}
          onToggle={(id) => patch({ zone: toggleToken(get('zone'), id) })}
          onClear={() => patch({ zone: null })}
        />

        <FilterMenu
          label="Canal"
          groups={[
            {
              options: ORDER_CHANNELS.map((c) => ({
                id: c,
                label: channelLabel(c),
                swatch: c === 'kiosk' ? 'bg-primary' : 'bg-tertiary',
              })),
            },
          ]}
          selected={channels}
          onToggle={(id) => patch({ channel: toggleToken(get('channel'), id) })}
          onClear={() => patch({ channel: null })}
          width={200}
        />

        {showStatus ? (
          <FilterMenu
            label="Estado"
            groups={[{ options: ORDER_STATUSES.map((s) => ({ id: s, label: statusLabel(s) })) }]}
            selected={statuses}
            onToggle={(id) => patch({ status: toggleToken(get('status'), id) })}
            onClear={() => patch({ status: null })}
            width={210}
          />
        ) : null}

        <div className="ml-auto flex items-center gap-3">
          {/* Reserved height so the row does not jump when this appears. */}
          <span className="flex h-4 items-center text-2xs uppercase tracking-[0.08em] text-muted">
            {pending ? 'Actualizando…' : ''}
          </span>

          {activeCount > 0 ? (
            <button
              type="button"
              onClick={() =>
                patch({
                  org: null,
                  fc: null,
                  r: null,
                  zone: null,
                  channel: null,
                  status: null,
                  from: null,
                  to: null,
                  range: '7d',
                })
              }
              className="flex cursor-pointer items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs text-text-secondary transition-colors duration-200 hover:bg-surface-container hover:text-secondary"
            >
              <Icon name="x" size={11} />
              Limpiar
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
