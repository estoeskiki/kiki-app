/**
 * Shared content width.
 *
 * Applied to both the filter bar's inner row and each page's content block so
 * the two align to the same left edge and the same right edge. The filter bar
 * itself still spans the full width — only its contents are constrained — so the
 * sticky border reaches the window edge.
 *
 * The cap matters for how the dashboard reads, not just for overflow: stretched
 * across 1900px, four KPI cards become four mostly-empty 450px boxes holding one
 * number each. Financial dashboards cap the measure for the same reason prose
 * does.
 */
export const CONTENT_WIDTH = 'mx-auto w-full max-w-[1440px] px-6 lg:px-8';
