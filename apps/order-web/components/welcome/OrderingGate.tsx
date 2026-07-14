'use client';

import { useSessionStore } from '@/store/useSessionStore';
import { Welcome } from './Welcome';

interface OrderingGateProps {
  name: string;
  bgUrl?: string | null;
  slogan?: string | null;
  children: React.ReactNode;
}

// Mirrors the kiosk's Welcome -> Menu flow. No separate order-type step —
// orderType defaults to 'dine-in' and stays editable at checkout instead.
export function OrderingGate({ name, bgUrl, slogan, children }: OrderingGateProps) {
  const hasEnteredOrdering = useSessionStore((s) => s.hasEnteredOrdering);
  const setHasEnteredOrdering = useSessionStore((s) => s.setHasEnteredOrdering);

  if (!hasEnteredOrdering) {
    return <Welcome name={name} bgUrl={bgUrl} slogan={slogan} onStart={() => setHasEnteredOrdering(true)} />;
  }

  return <>{children}</>;
}
