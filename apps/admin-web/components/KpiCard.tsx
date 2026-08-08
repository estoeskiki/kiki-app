import { Card, CardLabel } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
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
const ACCENT_DOT: Record<KpiAccent, string> = {
  lime: 'bg-primary shadow-[0_0_6px_var(--color-primary)]',
  cyan: 'bg-tertiary shadow-[0_0_6px_var(--color-tertiary)]',
  blue: 'bg-[#60a5fa] shadow-[0_0_6px_#60a5fa]',
  pink: 'bg-secondary shadow-[0_0_6px_var(--color-secondary)]',
};

export type KpiAccent = 'lime' | 'cyan' | 'blue' | 'pink';

export function KpiCard({
  label,
  value,
  change,
  goodWhenUp = true,
  spark,
  accent = 'lime',
}: {
  label: string;
  value: string;
  change: number | null;
  goodWhenUp?: boolean;
  spark?: number[];
  /** Ties this tile to a hue so four otherwise-identical cards read as distinct
   *  metrics at a glance, the way the reference dashboards' stat tiles do —
   *  reusing brand hues already in the palette rather than adding new ones. */
  accent?: KpiAccent;
}) {
  const up = (change ?? 0) >= 0;
  const good = change === null ? true : up === goodWhenUp;

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <span className={`size-1.5 shrink-0 rounded-full ${ACCENT_DOT[accent]}`} aria-hidden />
          <CardLabel>{label}</CardLabel>
        </span>

        {/* Delta as a tinted pill, not bare colored text — the flat "↓ 75%" in
            plain secondary-color text was the single biggest thing making these
            tiles read as a spreadsheet rather than a product. chevronDown
            reused rotated for "up", same trick already used for the FilterMenu
            caret rather than adding a second chevron icon to the set. */}
        {change === null ? (
          <span className="text-2xs text-muted">—</span>
        ) : (
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-bold tabular-nums ${
              good ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'
            }`}
            title="Comparado con el período anterior"
          >
            <Icon
              name="chevronDown"
              size={9}
              strokeWidth={3}
              className={up ? 'rotate-180' : ''}
            />
            {formatPercent(Math.abs(change), 0)}
          </span>
        )}
      </div>

      <div className="font-heading text-3xl font-bold leading-none tracking-[-0.04em] tabular-nums text-text-primary">
        {value}
      </div>

      {spark && spark.length > 1 ? (
        <div className="-mx-1 mt-3">
          <Sparkline values={spark} tone={good ? 'lime' : 'pink'} height={28} />
        </div>
      ) : null}
    </Card>
  );
}
