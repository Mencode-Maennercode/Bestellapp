import { useEffect, useState, type FormEvent } from 'react';
import type { EventPublic } from '@shared/types';
import { adminLogin, hasAdminSession } from '@/data/session';
import { useLive } from '@/data/live';
import { mount, Placeholder } from './mount';

function EventList() {
  const events = useLive<Record<string, { public: EventPublic }>>('events');
  if (events.status !== 'ready') return <Placeholder title="Laden …" />;
  const list = Object.entries(events.value ?? {});
  return (
    <Placeholder title="Veranstaltungen">
      {list.length ? list.map(([id, e]) => <p key={id}>{e.public?.name} · {e.public?.status}</p>) : 'Noch keine Veranstaltung.'}
    </Placeholder>
  );
}

function Admin() {
  const [ok, setOk] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    hasAdminSession().then(setOk);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await adminLogin(pin);
      setOk(true);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (ok === null) return <Placeholder title="Laden …" />;
  if (ok) return <EventList />;
  return (
    <Placeholder title="Verwaltung">
      <form onSubmit={submit} className="grid gap-2">
        <input
          className="rounded bg-[var(--surface-1)] p-3 text-center text-xl tracking-widest"
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label="Admin-PIN"
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
        />
        <button className="rounded bg-[var(--accent)] p-3 font-semibold text-white">Anmelden</button>
        {error && <p role="alert">{error}</p>}
      </form>
    </Placeholder>
  );
}

mount(<Admin />);
