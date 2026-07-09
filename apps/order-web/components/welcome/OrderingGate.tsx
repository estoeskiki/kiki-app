'use client';

import { useState } from 'react';
import { useSessionStore } from '@/store/useSessionStore';
import { Welcome } from './Welcome';
import { OrderTypeSelect } from './OrderTypeSelect';

interface OrderingGateProps {
  name: string;
  bgUrl?: string | null;
  children: React.ReactNode;
}

// Mirrors the kiosk's Welcome -> OrderType -> Menu flow. Skips the OrderType
// step when a table QR already told us this is dine-in (session.orderType is
// preset by setFromStorefront in that case).
export function OrderingGate({ name, bgUrl, children }: OrderingGateProps) {
  const orderType = useSessionStore((s) => s.orderType);
  const setOrderType = useSessionStore((s) => s.setOrderType);
  const hasEnteredOrdering = useSessionStore((s) => s.hasEnteredOrdering);
  const setHasEnteredOrdering = useSessionStore((s) => s.setHasEnteredOrdering);
  const [step, setStep] = useState<'welcome' | 'orderType' | 'done'>(hasEnteredOrdering ? 'done' : 'welcome');

  if (step === 'welcome') {
    return (
      <Welcome
        name={name}
        bgUrl={bgUrl}
        onStart={() => {
          setHasEnteredOrdering(true);
          setStep(orderType ? 'done' : 'orderType');
        }}
      />
    );
  }

  if (step === 'orderType' && !orderType) {
    return (
      <OrderTypeSelect
        onSelect={(type) => {
          setOrderType(type);
          setStep('done');
        }}
      />
    );
  }

  return <>{children}</>;
}
