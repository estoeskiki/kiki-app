import { Card, CardLabel } from '@/components/ui/Card';
import { Sparkline } from '@/components/charts/Sparkline';
import { formatPercent } from '@/lib/format';

/**
 * Metric tile. `change` is a signed ratio against the previous equal-length
 * window, or null when that window had nothing to compare against — a dash is
 * more honest there than "+100%".
 *
 * `goodWhenUp` exists because falling cancellations are good news; the arrow
 * shows direction, the colour shows whether that direction is welcome.
 */
export function KpiCard({
  label,
  value,
  change,
  goodWhenUp = true,
  spark,
}: {
  label: string;
  value: string;
  change: number | null;
  goodWhenUp?: boolean;
  spark?: number[];
}) {
  const up = (change ?? 0) >= 0;
  const good = change === null ? true : up === goodWhenUp;

  return (
    <Card className="p-5">
      <CardLabel className="mb-2.5">{label}</CardLabel>

      <div className="mb-2 font-heading text-[28px] font-bold leading-none tracking-[-0.04em] tabular-nums text-text-primary">
        {value}
      </div>

      {spark && spark.length > 1 ? (
        <div className="mb-2">
          <Sparkline values={spark} tone={good ? 'lime' : 'pink'} />
        </div>
      ) : null}

      <div className="flex items-center gap-1.5">
        {change === null ? (
          <span className="text-[11px] text-muted">sin período previo</span>
        ) : (
          <>
            <span className={`text-[11px] font-bold ${good ? 'text-primary' : 'text-secondary'}`}>
              {up ? '↑' : '↓'} {formatPercent(Math.abs(change))}
            </span>
            <span className="text-[11px] text-muted">vs período anterior</span>
          </>
        )}
      </div>
    </Card>
  );
}
