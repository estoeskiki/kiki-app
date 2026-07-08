interface WelcomeProps {
  name: string;
  onStart: () => void;
}

export function Welcome({ name, onStart }: WelcomeProps) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center gap-16 overflow-hidden bg-[#060e1d] px-8 text-center">
      <div className="absolute inset-x-0 top-0 h-1 bg-primary" />

      <div className="flex flex-col items-center gap-3">
        <div className="flex flex-col items-center">
          <h1 className="font-heading text-6xl font-black tracking-tighter text-white sm:text-7xl">KIKI</h1>
          <div className="mt-2 h-1 w-12 rounded-full bg-primary" />
        </div>
        <p className="font-body text-sm uppercase tracking-[0.2em] text-white/70">{name}</p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <button
          onClick={onStart}
          className="h-16 w-72 max-w-full rounded-xl bg-primary font-heading text-lg font-bold text-on-primary shadow-[0_8px_30px_-6px_rgba(204,255,0,0.6)] transition active:scale-[0.98]"
        >
          Comenzar pedido
        </button>
        <p className="font-body text-xs uppercase tracking-widest text-white/60">Bienvenido</p>
      </div>

      <p className="absolute bottom-8 font-body text-xs tracking-wide text-white/50">
        Con tecnología de <span className="font-bold text-primary">kiki</span>
      </p>
    </div>
  );
}
