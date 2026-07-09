import Image from 'next/image';

interface WelcomeProps {
  name: string;
  bgUrl?: string | null;
  slogan?: string | null;
  onStart: () => void;
}

export function Welcome({ name, bgUrl, slogan, onStart }: WelcomeProps) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center gap-14 overflow-hidden bg-[#060e1d] px-8 text-center">
      {bgUrl && (
        <>
          <Image src={bgUrl} alt="" fill priority sizes="100vw" className="object-cover" />
          {/* Same overlay values as the kiosk's WelcomeScreen media background,
              for text legibility over a photo. */}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(rgba(0,0,0,0.15), rgba(0,0,0,0.65))' }}
          />
        </>
      )}

      {/* Ambient lime glow behind the name — gives the dark hero depth even
          when there's no bg photo, without introducing a second color. */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.15] blur-[100px]"
        style={{ background: 'radial-gradient(circle, #ccff00, transparent 70%)' }}
      />

      <div className="absolute inset-x-0 top-0 h-1 bg-primary" />

      <div className="relative flex flex-col items-center gap-4">
        <p className="font-body text-xs font-bold uppercase tracking-[0.3em] text-primary">Bienvenido a</p>
        <div className="flex flex-col items-center">
          <h1 className="font-heading text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl">
            {name}
          </h1>
          <div className="mt-3 h-1 w-12 rounded-full bg-primary" />
        </div>
        {slogan && <p className="max-w-xs font-body text-base italic text-white/70">{slogan}</p>}
      </div>

      <div className="relative flex flex-col items-center">
        <button
          onClick={onStart}
          className="h-16 w-72 max-w-full rounded-xl bg-primary font-heading text-lg font-bold text-on-primary shadow-[0_8px_30px_-6px_rgba(204,255,0,0.6)] transition active:scale-[0.98]"
        >
          Comenzar pedido
        </button>
      </div>

      <p className="absolute bottom-8 font-body text-xs tracking-wide text-white/50">
        Powered by <span className="font-bold text-primary">kiki</span>
      </p>
    </div>
  );
}
