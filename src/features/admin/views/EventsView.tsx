import { CalendarPlus, Copy, FlagCheckered, Play, Stop } from '@phosphor-icons/react';
import { useState } from 'react';
import { slugify } from '@shared/slug';
import type { EventIndexEntry, EventMode } from '@shared/types';
import { api } from '@/data/api';
import { Badge, Button, Sheet } from '@/ui';
import { useAdmin } from '../context';
import { Card, ConfirmSheet, formatWhen, fromLocalInput, Segmented, SelectInput, STATUS_LABEL, statusTone, TextInput, toLocalInput, useAction } from '../ui';

const HOUR = 3600_000;

export function EventsView({ onOpen }: { onOpen: (tab: 'uebersicht' | 'einstellungen') => void }) {
  const { events, select } = useAdmin();
  const { busy, run } = useAction();
  const [creating, setCreating] = useState<{ copyFrom?: string } | null>(null);
  const [ending, setEnding] = useState<[string, EventIndexEntry] | null>(null);

  const setStatus = (id: string, status: 'draft' | 'live', ok: string) => run(() => api.updateEvent({ eventId: id, status }), ok);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[2.5rem] leading-none font-extrabold uppercase">Veranstaltungen</h2>
          <p className="mt-2 max-w-[60ch] text-ink-2 text-pretty">
            Jede Veranstaltung hat eigene Tisch-QR-Codes und eigene Personal-Links. Alte Codes und Links funktionieren in der nächsten nie – auch nicht mit alten Daten auf dem Handy.
          </p>
        </div>
        <Button icon={<CalendarPlus size={22} weight="bold" />} onClick={() => setCreating({ copyFrom: events[0]?.[0] })} size="lg">Neue Veranstaltung</Button>
      </div>

      {events.length === 0 && (
        <Card>
          <p className="text-ink-2">Noch keine Veranstaltung. Mit „Neue Veranstaltung“ startest du mit der Standard-Karte; Tische und Preise passt du danach an.</p>
        </Card>
      )}

      <ul className="grid gap-3 lg:grid-cols-2">
        {events.map(([id, e]) => (
          <li key={id}>
            <Card className="h-full">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-[1.875rem] leading-[1.02] font-extrabold uppercase text-balance">{e.name}</h3>
                  <p className="mt-1.5 text-ink-2">{formatWhen(e.startsAt)} – {formatWhen(e.endsAt)}</p>
                  <p className="mt-0.5 text-[0.9375rem] text-ink-3">
                    {e.mode === 'tables' ? 'Mit Tischen' : 'Ohne Tische (Schnellbons)'}
                    {e.slug && <> · Ordner <span className="font-bold text-ink-2">/{e.slug}/</span></>}
                  </p>
                </div>
                <Badge tone={statusTone(e.status)}>{STATUS_LABEL[e.status]}</Badge>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => { select(id); onOpen('uebersicht'); }}>Öffnen</Button>
                {e.status === 'draft' && <Button icon={<Play size={20} weight="fill" />} busy={busy} onClick={() => void setStatus(id, 'live', 'Veranstaltung ist live')}>Live schalten</Button>}
                {e.status === 'live' && <Button variant="secondary" busy={busy} onClick={() => void setStatus(id, 'draft', 'Zurück auf Entwurf – Gäste können nicht bestellen')}>Auf Entwurf</Button>}
                {e.status !== 'closed' && <Button variant="quiet" icon={<Stop size={20} weight="fill" />} onClick={() => setEnding([id, e])}>Beenden</Button>}
                <Button variant="quiet" icon={<Copy size={20} weight="bold" />} onClick={() => setCreating({ copyFrom: id })}>Duplizieren</Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <CreateSheet
        state={creating}
        onClose={() => setCreating(null)}
        onCreated={() => {
          setCreating(null);
          onOpen('uebersicht');
        }}
      />

      <ConfirmSheet
        open={!!ending}
        onClose={() => setEnding(null)}
        title="Veranstaltung beenden?"
        confirmLabel="Endgültig beenden"
        busy={busy}
        onConfirm={() => ending && void run(() => api.closeEvent(ending[0]), 'Veranstaltung beendet').then(ok => ok && setEnding(null))}
      >
        <p><strong className="text-ink">{ending?.[1].name}</strong> wird abgeschlossen. Das lässt sich nicht rückgängig machen:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Alle Tisch-QR-Codes sagen „Veranstaltung beendet“.</li>
          <li>Kellner- und Theken-Link sind gelöscht, alle Geräte sofort ausgesperrt.</li>
          <li>Die Statistik bleibt als Archiv erhalten, die Karte dient als Vorlage zum Duplizieren.</li>
        </ul>
      </ConfirmSheet>
    </div>
  );
}

function CreateSheet({ state, onClose, onCreated }: { state: { copyFrom?: string } | null; onClose: () => void; onCreated: () => void }) {
  const { events, select } = useAdmin();
  return (
    <Sheet open={!!state} onClose={onClose} title={state?.copyFrom ? 'Veranstaltung duplizieren' : 'Neue Veranstaltung'} subtitle="Neue Codes und Links werden automatisch erzeugt">
      {state && <CreateForm key={state.copyFrom ?? 'new'} copyFrom={state.copyFrom} events={events} onClose={onClose} onCreated={id => { select(id); onCreated(); }} />}
    </Sheet>
  );
}

function CreateForm({
  copyFrom: initialCopy, events, onClose, onCreated,
}: {
  copyFrom?: string;
  events: [string, EventIndexEntry][];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { busy, run } = useAction();
  const source = events.find(([id]) => id === initialCopy)?.[1];
  const start = Math.ceil((Date.now() + 24 * HOUR) / HOUR) * HOUR;
  const [name, setName] = useState('');
  const [startsAt, setStartsAt] = useState(toLocalInput(start));
  const [endsAt, setEndsAt] = useState(toLocalInput(start + 6 * HOUR));
  const [mode, setMode] = useState<EventMode>(source?.mode ?? 'tables');
  const [copyFrom, setCopyFrom] = useState(initialCopy ?? '');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);

  const effectiveSlug = slugTouched ? slug : slugify(name).length >= 3 && name ? slugify(name) : '';
  const slugOk = !effectiveSlug || /^[A-Za-z0-9][A-Za-z0-9-]{2,39}$/.test(effectiveSlug);
  const s = fromLocalInput(startsAt);
  const e = fromLocalInput(endsAt);
  const valid = name.trim().length > 0 && Number.isFinite(s) && Number.isFinite(e) && e > s && slugOk;

  const submit = async () => {
    let created = '';
    const ok = await run(async () => {
      ({ eventId: created } = await api.createEvent({
        name: name.trim(), startsAt: s, endsAt: e, mode, ...(effectiveSlug ? { slug: effectiveSlug } : {}), ...(copyFrom ? { copyFrom } : {}),
      }));
    }, 'Veranstaltung angelegt');
    if (ok) onCreated(created);
  };

  return (
    <form className="flex flex-col gap-4 pb-2" onSubmit={ev => { ev.preventDefault(); if (valid) void submit(); }}>
      <TextInput label="Name" value={name} onChange={ev => setName(ev.target.value)} maxLength={40} placeholder="z. B. Prunksitzung 2027" autoFocus required />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Beginn" type="datetime-local" value={startsAt} onChange={ev => setStartsAt(ev.target.value)} required />
        <TextInput label="Ende" type="datetime-local" value={endsAt} onChange={ev => setEndsAt(ev.target.value)} required hint="Eine Stunde nach dem Ende ist Schluss für Bestellungen und Personal-Sitzungen." />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[0.9375rem] font-bold text-ink-2">Ablauf</span>
        <Segmented<EventMode> label="Ablauf" value={mode} onChange={setMode} options={[['tables', 'Mit Tischen'], ['noTables', 'Ohne Tische']]} />
        <p className="text-[0.875rem] text-ink-3">{mode === 'tables' ? 'Gäste bestellen per QR-Code am Tisch.' : 'Keine Gast-QR-Codes: Kellner schreiben Schnellbons.'}</p>
      </div>
      <SelectInput label="Karte, Tische und Theken übernehmen von" value={copyFrom} onChange={ev => setCopyFrom(ev.target.value)} hint="Preise und Produkte werden kopiert, „ausverkauft“ zurückgesetzt. Tische behalten ihre Nummern, bekommen aber neue Codes.">
        <option value="">Standard-Karte (neu)</option>
        {events.map(([id, ev]) => <option key={id} value={id}>{ev.name}</option>)}
      </SelectInput>
      <TextInput
        label="Ordner auf der Website (optional)"
        value={effectiveSlug}
        onChange={ev => { setSlug(ev.target.value.replace(/\s+/g, '-')); setSlugTouched(true); }}
        placeholder="Hochzeit-Meier"
        aria-invalid={!slugOk}
        hint={slugOk ? 'Mit Ordner liegt die Veranstaltung unter praesenzwert.de/<Ordner>/ – nach dem Fest löschst du den Ordner und alle Adressen sind tot. Leer lassen = normale Seite.' : '3–40 Zeichen: Buchstaben, Ziffern und „-“.'}
      />
      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onClose}>Abbrechen</Button>
        <Button type="submit" busy={busy} disabled={!valid} icon={<FlagCheckered size={20} weight="bold" />}>Anlegen</Button>
      </div>
    </form>
  );
}
