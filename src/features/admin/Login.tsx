import { Backspace, Lock } from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';
import { adminLogin } from '@/data/session';
import { Button, cx } from '@/ui';

const bokeh = `${import.meta.env.BASE_URL}img/bokeh-dunkel.webp`;
const MAX = 8;
const MIN = 4;

/** PIN pad. The PIN is checked on the server (scrypt, lock after 5 wrong tries); nothing is stored in the browser. */
export function Login({ onDone, expired }: { onDone: () => void; expired?: boolean }) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = useCallback(
    async (value: string) => {
      if (value.length < MIN || busy) return;
      setBusy(true);
      setError('');
      try {
        await adminLogin(value);
        onDone();
      } catch (e) {
        setError((e as Error).message);
        setPin('');
      } finally {
        setBusy(false);
      }
    },
    [busy, onDone],
  );

  const press = useCallback((d: string) => setPin(p => (p.length < MAX ? p + d : p)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') setPin(p => p.slice(0, -1));
      else if (e.key === 'Enter') void submit(pin);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press, submit, pin]);

  return (
    <main className="relative isolate grid min-h-dvh place-items-center overflow-hidden gutter py-10">
      <img src={bokeh} alt="" aria-hidden className="pointer-events-none absolute inset-0 -z-10 size-full object-cover opacity-45" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-bg via-bg/80 to-bg/40" />
      <div className="w-full max-w-xs">
        <Lock size={36} weight="duotone" className="mb-4 text-accent-2" aria-hidden />
        <h1 className="font-display text-[3.25rem] leading-[0.92] font-extrabold uppercase">Verwaltung</h1>
        <p className="mt-2 text-ink-2">{expired ? 'Die Sitzung ist abgelaufen. Bitte PIN erneut eingeben.' : 'Admin-PIN eingeben.'}</p>

        <div className="my-6 flex h-6 items-center justify-center gap-3" role="img" aria-label={`${pin.length} Ziffern eingegeben`}>
          {Array.from({ length: Math.max(pin.length, MIN) }, (_, i) => (
            <span key={i} className={cx('size-3.5 rounded-full transition-colors', i < pin.length ? 'bg-accent-2' : 'bg-surface-3')} />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
            <PadKey key={d} onClick={() => press(d)}>{d}</PadKey>
          ))}
          <PadKey onClick={() => setPin(p => p.slice(0, -1))} label="Löschen"><Backspace size={26} weight="bold" /></PadKey>
          <PadKey onClick={() => press('0')}>0</PadKey>
          <Button disabled={pin.length < MIN} busy={busy} onClick={() => void submit(pin)} className="min-h-16">OK</Button>
        </div>

        <p role="alert" className="mt-4 min-h-6 font-semibold text-late">{error}</p>
      </div>
    </main>
  );
}

function PadKey({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="num grid min-h-16 place-items-center rounded-[var(--radius-btn)] surface-3 text-[2rem] leading-none font-bold transition-transform active:scale-95"
    >
      {children}
    </button>
  );
}
