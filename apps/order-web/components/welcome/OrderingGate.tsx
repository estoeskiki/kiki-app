'use client';

import { useSessionStore } from '@/store/useSessionStore';
import { Welcome } from './Welcome';
import { OrderTypeSelect } from './OrderTypeSelect';

interface OrderingGateProps {
  name: string;
  bgUrl?: string | null;
  slogan?: string | null;
  children: React.ReactNode;
}

// Mirrors the kiosk's Welcome -> OrderType -> Menu flow. Skips the OrderType
// step when a table QR already told us this is dine-in (session.orderType is
// preset by setFromStorefront in that case).
//
// Step is derived directly from session store state (not local component
// state) so that useSessionStore.restartOrdering() — the "empezar de nuevo"
// control — immediately re-shows Welcome without needing this component to
// unmount/remount.
export function OrderingGate({ name, bgUrl, slogan, children }: OrderingGateProps) {
  const orderType = useSessionStore((s) => s.orderType);
  const setOrderType = useSessionStore((s) => s.setOrderType);
  const hasEnteredOrdering = useSessionStore((s) => s.hasEnteredOrdering);
  const setHasEnteredOrdering = useSessionStore((s) => s.setHasEnteredOrdering);

  if (!hasEnteredOrdering) {
    return <Welcome name={name} bgUrl={bgUrl} slogan={slogan} onStart={() => setHasEnteredOrdering(true)} />;
  }

  if (!orderType) {
    return <OrderTypeSelect onSelect={setOrderType} />;
  }

  return <>{children}</>;
}
