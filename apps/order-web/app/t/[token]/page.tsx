'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getPublicStorefront } from '@/lib/api';
import { useSessionStore } from '@/store/useSessionStore';

export default function TableQrLandingPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const setFromStorefront = useSessionStore((s) => s.setFromStorefront);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPublicStorefront({ tableToken: token })
      .then((data) => {
        if (data.type === 'restaurant') {
          setFromStorefront(data.restaurant.slug, token, data);
          router.replace(`/r/${data.restaurant.slug}`);
        } else if (data.type === 'food_court') {
          setFromStorefront(data.foodCourt.slug, token, data);
          router.replace(`/mall/${data.foodCourt.slug}`);
        } else {
          setError('Este código QR ya no es válido. Por favor pide ayuda al personal.');
        }
      })
      .catch((err) => {
        console.error('getPublicStorefront failed', err);
        setError('No se pudo conectar. Por favor revisa tu conexión e intenta de nuevo.');
      });
  }, [token, router, setFromStorefront]);

  return (
    <div className="flex min-h-dvh items-center justify-center p-8">
      <p className="text-center font-body text-text-muted">{error ?? 'Buscando tu mesa…'}</p>
    </div>
  );
}
