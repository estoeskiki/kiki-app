import { formatDuration, formatMoney, formatNumber, formatPercent } from '@/lib/format';
import type { OrderPipeline, OrderStatus, StageDurations } from '@/lib/types';

const STAGE_META: Record<OrderStatus, { label: string; bar: string; text: string; dot: string }> = {
  confirmed: { label: 'Confirmado', bar: 'bg-[#60a5fa]', text: 'text-[#60a5fa]', dot: 'bg-[#60a5fa]' },
  preparing: { label: 'Preparando', bar: 'bg-tertiary', text: 'text-tertiary', dot: 'bg-tertiary' },
  ready: { label: 'Listo', bar: 'bg-primary', text: 'text-primary', dot: 'bg-primary' },
  completed: { label: 'Entregado', bar: 'bg-success', text: 'text-success', dot: 'bg-success' },
  cancelled: { label: 'Cancelado', bar: 'bg-secondary', text: 'text-secondary', dot: 'bg-secondary' },
};

const LIVE_STAGES: OrderStatus[] = ['confirmed', 'preparing', 'ready', 'completed'];

/**
 * Order lifecycle as a pipeline.
 *
 * Each order sits in exactly one stage — that of its least advanced live stall —
 * so the composition bar is a true breakdown of the order total and the
 * percentages are real. Deliberately not drawn as a tapering funnel: order status
 * is current state, not an accumulating sequence, and a funnel silhouette would
 * imply conversion arithmetic the data does not support.
 *
 * Stage descriptions ("Pagado, sin empezar", "En cocina") used to sit under each
 * number. They explained the domain to someone who already runs it, and four
 * lines of 11px grey text under four numbers is most of what made this card look
 * busy. The stage names carry it — the one line of small text each tile carries
 * now (avg time in that stage) earns its place because it's a number nobody
 * could otherwise see, not a restatement of the label above it.
 */
export function Pipeline({
  data,
  stageDurations,
}: {
  data: OrderPipeline;
  stageDurations: StageDurations;
}) {
  const byStage = new Map(data.stages.map((s) => [s.stage, s]));

  if (data.total_orders === 0) {
    return <p className="py-10 text-center text-xs text-muted">Sin pedidos en este período.</p>;
  }

  const cancelled = byStage.get('cancelled');

  return (
    <div>
      {/* Headline rates. A grid, not a flex row with gaps: the labels are
          variable-length and uppercase, and with flex they collided into each
          other ("TASA DE ENTREGAEN CURSO") once the card got narrow. */}
      <div className="mb-6 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
        <Rate
          label="Tasa de entrega"
          value={formatPercent(data.completion_rate, 0)}
          tone="text-success"
        />
        <Rate label="En curso" value={formatNumber(data.in_progress)} tone="text-primary" />
        <Rate
          label="Cancelación"
          value={formatPercent(data.cancellation_rate, 0)}
          tone={data.cancellation_rate > 0.05 ? 'text-secondary' : 'text-text-primary'}
        />
        <Rate
          label="Valor"
          value={formatMoney(data.total_revenue_cents)}
          tone="text-text-primary"
        />
        {/* Null (not 0) means nothing finished in this window yet — "sin datos"
            reads honestly instead of implying instant fulfillment. */}
        <Rate
          label="Tiempo promedio"
          value={data.avg_fulfillment_seconds !== null ? formatDuration(data.avg_fulfillment_seconds) : '—'}
          tone="text-tertiary"
        />
      </div>

      {/* Composition bar — segment widths are true shares. */}
      <div
        className="mb-5 flex h-2 w-full gap-px overflow-hidden rounded-full bg-line"
        role="img"
        aria-label={`Distribución: ${data.stages
          .filter((s) => s.orders > 0)
          .map((s) => `${STAGE_META[s.stage].label} ${s.orders}`)
          .join(', ')}`}
      >
        {data.stages
          .filter((stage) => stage.orders > 0)
          .map((stage) => (
            <div
              key={stage.stage}
              className={`h-full ${STAGE_META[stage.stage].bar} transition-[flex-grow] duration-500`}
              style={{ flexGrow: stage.orders, flexBasis: 0 }}
              title={`${STAGE_META[stage.stage].label}: ${stage.orders} (${formatPercent(stage.share, 0)})`}
            />
          ))}
      </div>

      <ol className="grid gap-3 sm:grid-cols-4">
        {LIVE_STAGES.map((stage) => {
          const meta = STAGE_META[stage];
          const orders = byStage.get(stage)?.orders ?? 0;
          const share = byStage.get(stage)?.share ?? 0;
          // Avg time orders spend *in* this stage before moving on — a
          // different number from the stage's order count above it, built from
          // order_status_events (042) rather than the current snapshot, so it
          // stays empty until real transitions accumulate.
          const avgInStage = stageDurations[stage];

          return (
            <li key={stage} className="rounded-md border border-line bg-surface-container p-4">
              <div className="mb-2.5 flex items-center gap-2">
                <span className={`size-1.5 shrink-0 rounded-full ${meta.dot}`} aria-hidden />
                <span className="text-2xs font-bold uppercase tracking-[0.08em] text-muted">
                  {meta.label}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span
                  className={`font-heading text-3xl font-bold leading-none tracking-[-0.03em] tabular-nums ${
                    orders > 0 ? meta.text : 'text-muted'
                  }`}
                >
                  {formatNumber(orders)}
                </span>
                <span className="text-xs tabular-nums text-muted">{formatPercent(share, 0)}</span>
              </div>
              {avgInStage ? (
                <div className="mt-1.5 text-2xs tabular-nums text-muted">
                  ~{formatDuration(avgInStage.avg_seconds)} en esta etapa
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      {cancelled && cancelled.orders > 0 ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-secondary/25 bg-secondary/[0.06] px-4 py-3">
          <span className="flex items-center gap-2">
            <span className="size-1.5 shrink-0 rounded-full bg-secondary" aria-hidden />
            <span className="text-2xs font-bold uppercase tracking-[0.08em] text-secondary">
              {STAGE_META.cancelled.label}
            </span>
          </span>
          <span className="flex items-baseline gap-2">
            <span className="font-heading text-lg font-bold tabular-nums text-secondary">
              {formatNumber(cancelled.orders)}
            </span>
            <span className="text-xs tabular-nums text-muted">
              {formatPercent(cancelled.share, 0)}
            </span>
          </span>
        </div>
      ) : null}
    </div>
  );
}

function Rate({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 truncate text-2xs font-bold uppercase tracking-[0.09em] text-muted">
        {label}
      </div>
      <div
        className={`font-heading text-3xl font-bold leading-none tracking-[-0.04em] tabular-nums ${tone}`}
      >
        {value}
      </div>
    </div>
  );
}
