'use client';

import { useState } from 'react';
import { useSessionStore } from '@/store/useSessionStore';
import { Welcome } from './Welcome';
import { OrderTypeSelect } from './OrderTypeSelect';

interface OrderingGateProps {
  name: string;
  children: React.ReactNode;
}

// Mirrors the kiosk's Welcome -> OrderType -> Menu flow. Skips the OrderType
// step when a table QR already told us this is dine-in (session.orderType is
// preset by setFromStorefront in that case).
export function OrderingGate({ name, children }: OrderingGateProps) {
  const orderType = useSessionStore((s) => s.orderType);
  const setOrderType = useSessionStore((s) => s.setOrderType);
  const [step, setStep] = useState<'welcome' | 'orderType' | 'done'>('welcome');

  if (step === 'welcome') {
    return <Welcome name={name} onStart={() => setStep(orderType ? 'done' : 'orderType')} />;
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
