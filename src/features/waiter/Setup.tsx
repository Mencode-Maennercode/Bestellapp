import { ArrowRight, BellRinging, BellSlash } from '@phosphor-icons/react';
import { useState, type FormEvent, type ReactNode } from 'react';
import type { Table } from '@shared/types';
import { Button, cx } from '@/ui';
import { Sash } from '@/features/staff/parts';
import { TablePicker } from './TablePicker';

const bokeh = `${import.meta.env.BASE_URL}img/bokeh-dunkel.webp`;

function Shell({ step, steps, eventName, title, text, children, footer }: {
  step: number;
  steps: number;
  eventName: string;
  title: string;
  text?: ReactNode;
  children?: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col">
      <img src={bokeh} alt="" aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[46dvh] w-full object-cover opacity-45 [mask-image:linear-gradient(to_bottom,black_20%,transparent)]" />
      <div className="pt-[var(--safe-top)]">
        <Sash />
      </div>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gutter pt-8">
        <div className="flex items-center justify-between gap-4">
          <p className="min-w-0 truncate font-bold text-ink-2">{eventName}</p>
          <div className="flex shrink-0 gap-1.5" aria-label={`Schritt ${step} von ${steps}`}>
            {Array.from({ length: steps }, (_, i) => (
              <span key={i} className={cx('h-1.5 w-6 rounded-full', i < step ? 'bg-accent-2' : 'bg-surface-3')} />
            ))}
          </div>
        </div>
        <h1 className="mt-10 font-display text-[clamp(2.75rem,13vw,4.25rem)] leading-[0.92] font-extrabold uppercase text-balance">{title}</h1>
        {text && <p className="mt-3 max-w-[38ch] text-lg text-ink-2 text-pretty">{text}</p>}
        <div className="mt-7 flex-1">{children}</div>
      </main>
      <div className="sticky bottom-0 bg-gradient-to-t from-bg via-bg to-bg/0 pt-6 pb-[max(1rem,var(--safe-bottom))]">
        <div className="mx-auto grid max-w-xl gap-2 gutter">{footer}</div>
      </div>
    </div>
  );
}

export function NameStep({ eventName, steps, initial, onDone }: { eventName: string; steps: number; initial: string; onDone: (name: string) => void }) {
  const [name, setName] = useState(initial);
  const ok = name.trim().length > 0;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (ok) onDone(name.trim());
  };
  return (
    <form onSubmit={submit}>
      <Shell
        step={1}
        steps={steps}
        eventName={eventName}
        title="Wie heißt du?"
        text={<>Der Gast sieht ihn im Status: <q>{name.trim() || 'Anna'} bringt’s</q>.</>}
        footer={<Button type="submit" size="lg" disabled={!ok} icon={<ArrowRight size={22} weight="bold" />}>Weiter</Button>}
      >
        <input
          autoFocus
          value={name}
          maxLength={40}
          onChange={e => setName(e.target.value)}
          autoComplete="given-name"
          enterKeyHint="next"
          aria-label="Dein Name"
          placeholder="Vorname"
          className="min-h-16 w-full rounded-[var(--radius-btn)] bg-surface-2 px-5 text-[1.5rem] font-bold shadow-[var(--edge)] outline-none focus-visible:outline-2 focus-visible:outline-accent-2"
        />
      </Shell>
    </form>
  );
}

export function TablesStep({ eventName, steps, tables, initial, takenBy, onDone }: {
  eventName: string;
  steps: number;
  tables: Record<string, Table>;
  initial: string[];
  takenBy: Record<string, string>;
  onDone: (ids: string[]) => void;
}) {
  const [ids, setIds] = useState(initial);
  return (
    <Shell
      step={2}
      steps={steps}
      eventName={eventName}
      title="Deine Tische"
      text="Bestellungen und Rufe dieser Tische landen bei dir. Ändern geht jederzeit oben über deinen Namen."
      footer={
        <Button size="lg" onClick={() => onDone(ids)} variant={ids.length ? 'primary' : 'secondary'} icon={<ArrowRight size={22} weight="bold" />}>
          {ids.length ? 'Weiter' : 'Ohne feste Tische weiter'}
        </Button>
      }
    >
      <TablePicker tables={tables} value={ids} onChange={setIds} takenBy={takenBy} />
    </Shell>
  );
}

export function AlarmStep({ eventName, steps, onDone }: { eventName: string; steps: number; onDone: (withAlarm: boolean) => void }) {
  return (
    <Shell
      step={steps}
      steps={steps}
      eventName={eventName}
      title="Alarm einschalten"
      text="Bei neuer Bestellung klingelt und vibriert dein Handy, der Tisch erscheint groß auf dem Bildschirm. Der Bildschirm bleibt an, solange die Seite offen ist."
      footer={
        <>
          <Button size="lg" onClick={() => onDone(true)} icon={<BellRinging size={22} weight="fill" />}>
            Alarm einschalten
          </Button>
          <Button variant="quiet" onClick={() => onDone(false)} icon={<BellSlash size={20} weight="bold" />}>
            Ohne Ton weiter
          </Button>
        </>
      }
    >
      <ul className="flex flex-col gap-3 text-ink-2">
        <li className="rounded-[var(--radius-card)] bg-surface-1 px-4 py-3.5 shadow-[var(--edge)]">
          <span className="font-bold text-ink">Handy laut stellen.</span> Lautlos-Modus schaltet auch den Alarm stumm.
        </li>
        <li className="rounded-[var(--radius-card)] bg-surface-1 px-4 py-3.5 shadow-[var(--edge)]">
          <span className="font-bold text-ink">Benachrichtigungen erlauben,</span> wenn gefragt. Dann kommt eine Meldung auch bei gesperrtem Handy (Android, Chrome).
        </li>
      </ul>
    </Shell>
  );
}
