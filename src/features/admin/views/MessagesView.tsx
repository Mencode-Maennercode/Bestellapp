import { Megaphone, PaperPlaneTilt } from '@phosphor-icons/react';
import { ref, remove, set } from 'firebase/database';
import { useState } from 'react';
import type { Broadcast } from '@shared/types';
import { db } from '@/data/firebase';
import { Button } from '@/ui';
import { useEvent } from '../context';
import { Card, formatWhen, Segmented, TextArea, useAction } from '../ui';

const TARGETS: [Broadcast['target'], string][] = [['all', 'Alle'], ['guests', 'Nur Gäste'], ['staff', 'Nur Personal']];

const QUICK = [
  'Gleich geht es los – bitte jetzt noch bestellen!',
  'Letzte Runde! Bestellungen nehmen wir noch bis zur Pause an.',
  'Bitte die Gänge frei halten – der Einzug beginnt.',
  'Bitte Vorsicht, Getränke kommen durch den Saal.',
];

export function MessagesView() {
  const ev = useEvent();
  const { busy, run } = useAction();
  const [text, setText] = useState('');
  const [target, setTarget] = useState<Broadcast['target']>('all');
  const current = ev.system.broadcast;
  const path = `events/${ev.id}/system/broadcast`;

  const send = async () => {
    const message = text.trim();
    if (!message) return;
    const entry: Broadcast = { message, target, createdAt: Date.now() };
    if (await run(() => set(ref(db, path), entry), 'Durchsage gesendet')) setText('');
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-[2.5rem] leading-none font-extrabold uppercase">Nachrichten</h2>
        <p className="mt-2 max-w-[60ch] text-ink-2 text-pretty">Eine Durchsage erscheint sofort als Hinweis auf den Handys. Gäste können sie wegtippen; eine neue Durchsage ersetzt die alte.</p>
      </div>

      {current && (
        <Card title="Aktuell sichtbar" action={<Button variant="secondary" busy={busy} onClick={() => void run(() => remove(ref(db, path)), 'Durchsage zurückgezogen')}>Zurückziehen</Button>}>
          <p className="flex gap-3 rounded-[var(--radius-btn)] bg-accent-2 px-4 py-3 font-bold text-accent-2-ink text-pretty">
            <Megaphone size={22} weight="fill" className="mt-0.5 shrink-0" aria-hidden />
            {current.message}
          </p>
          <p className="mt-2 text-[0.9375rem] text-ink-3">{TARGETS.find(([t]) => t === current.target)?.[1]} · {formatWhen(current.createdAt)}</p>
        </Card>
      )}

      {!ev.closed ? (
        <Card title="Neue Durchsage">
          <form className="flex flex-col gap-4" onSubmit={e => { e.preventDefault(); void send(); }}>
            <TextArea label="Text" value={text} onChange={e => setText(e.target.value)} maxLength={280} placeholder="Was sollen Gäste und Personal jetzt wissen?" hint={`${text.length}/280 Zeichen`} />
            <div className="flex flex-wrap gap-2" aria-label="Vorschläge">
              {QUICK.map(q => (
                <button key={q} type="button" onClick={() => setText(q)} className="min-h-11 rounded-full bg-surface-3 px-3.5 py-2 text-left text-[0.9375rem] font-bold text-ink-2 shadow-[var(--edge)] hover:text-ink">
                  {q}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Segmented label="Empfänger" value={target} onChange={setTarget} options={TARGETS} />
              <Button type="submit" size="lg" busy={busy} disabled={!text.trim()} icon={<PaperPlaneTilt size={22} weight="fill" />} className="ml-auto">Senden</Button>
            </div>
          </form>
        </Card>
      ) : (
        <p role="status" className="rounded-[var(--radius-btn)] bg-surface-2 px-4 py-3 font-bold text-ink-2">Die Veranstaltung ist beendet.</p>
      )}
    </div>
  );
}
