export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="font-heading text-3xl font-black tracking-tight text-text-primary">kiki</h1>
      <p className="max-w-sm font-body text-text-muted">
        Escanea el código QR en tu mesa, o abre el enlace que tu restaurante compartió contigo, para comenzar tu pedido.
      </p>
      <p className="mt-4 font-body font-bold text-xs tracking-[-0.02em] text-text-muted">
        powered by <span className="font-heading font-bold tracking-[-0.036em] text-primary">kiki</span>
      </p>
    </div>
  );
}
