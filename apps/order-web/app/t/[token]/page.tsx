'use client';

import { useParams } from 'next/navigation';
import { TableLanding } from '@/components/welcome/TableLanding';

// This is the real, only production entry point for ordering — every table
// QR points here. It resolves the token and renders the storefront directly,
// staying at /t/[token] the whole time (no redirect to /mall or /r), so the
// URL itself always reflects "this order came from a scanned location" and
// can't be silently dropped by a bare /mall/<slug> or /r/<slug> visit.
export default function TableQrLandingPage() {
  const { token } = useParams<{ token: string }>();
  return <TableLanding token={token} />;
}
