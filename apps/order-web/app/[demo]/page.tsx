import { notFound } from 'next/navigation';
import { TableLanding } from '@/components/welcome/TableLanding';
import { DEMOS, isDemoSlug } from '@/lib/demo';

// Short, shareable demo links — order.estoeskiki.com/demo-1. Only the slugs in
// DEMOS exist; every other top-level path 404s instead of reaching the RPC.
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(DEMOS).map((demo) => ({ demo }));
}

export default async function DemoPage({ params }: { params: Promise<{ demo: string }> }) {
  const { demo } = await params;
  if (!isDemoSlug(demo)) notFound();
  return <TableLanding token={demo} />;
}
