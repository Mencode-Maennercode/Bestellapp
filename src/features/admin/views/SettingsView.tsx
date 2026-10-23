import { Copy, FloppyDisk, SignOut } from '@phosphor-icons/react';
import { useState } from 'react';
import { api } from '@/data/api';
import { Button, cx, useToast } from '@/ui';
import { useEvent } from '../context';
import { Card, copyText, fromLocalInput, inputClass, Segmented, TextInput, toLocalInput, useAction } from '../ui';

export function SettingsView({ onLogout }: { onLogout: () => void }) {
  const ev = useEvent();
  return (
    <div className="space-y-4">
      <h2 className="font-display text-[2.5rem] leading-none font-extrabold uppercase">Einstellungen</h2>
      <EventForm key={`${ev.id}-${ev.pub.name}-${ev.pub.startsAt}-${ev.pub.endsAt}`} />
      <Publishing key={`p-${ev.id}-${ev.pub.slug}`} />
      <PinCard />
      <Card title="Abmelden" subtitle="Die Sitzung endet nach 12 Stunden von selbst.">
        <Button variant="secondary" icon={<SignOut size={20} weight="bold" />} onClick={onLogout}>Jetzt abmelden</Button>
      </Card>
    </div>
  );
}

function EventForm() {
  const ev = useEvent();
  const { busy, run } = useAction();
  const p = ev.pub;
  const [name, setName] = useState(p.name);
  const [startsAt, setStartsAt] = useState(toLocalInput(p.startsAt));
  const [endsAt, setEndsAt] = useState(toLocalInput(p.endsAt));
  const [language, setLanguage] = useState(p.language);
  const [archive, setArchive] = useState(String(p.archiveMinutes));
  const [primary, setPrimary] = useState(p.accent.primary);
  const [secondary, setSecondary] = useState(p.accent.secondary);

  const s = fromLocalInput(startsAt);
  const e = fromLocalInput(endsAt);
  const minutes = Number(archive);
  const valid = name.trim().length > 0 && e > s && Number.isInteger(minutes) && minutes >= 1 && minutes <= 240;
  const changed = name.trim() !== p.name || s !== p.startsAt || e !== p.endsAt || language !== p.language || minutes !== p.archiveMinutes || primary !== p.accent.primary || secondary !== p.accent.secondary;

  const save = () =>
    run(
      () => api.updateEvent({ eventId: ev.id, name: name.trim(), startsAt: s, endsAt: e, language, archiveMinutes: minutes, accent: { primary, secondary } }),
      'Gespeichert',
    );

  return (
    <Card title="Veranstaltung" subtitle={ev.closed ? 'Beendet – nur zur Ansicht.' : 'Gilt sofort für Gäste und Personal.'}>
      <form className="flex flex-col gap-4" onSubmit={ev2 => { ev2.preventDefault(); if (valid && changed) void save(); }}>
        <fieldset disabled={ev.closed} className="flex flex-col gap-4 disabled:opacity-70">
          <TextInput label="Name" value={name} onChange={x => setName(x.target.value)} maxLength={40} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Beginn" type="datetime-local" value={startsAt} onChange={x => setStartsAt(x.target.value)} required />
            <TextInput label="Ende" type="datetime-local" value={endsAt} onChange={x => setEndsAt(x.target.value)} required aria-invalid={e <= s} hint="Gäste können von 1 Stunde vor Beginn bis 1 Stunde nach Ende bestellen." />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[0.9375rem] font-bold text-ink-2">Sprache für Gäste</span>
            <Segmented label="Sprache" value={language} onChange={setLanguage} options={[['koelsch', 'Kölsch'], ['hochdeutsch', 'Hochdeutsch']]} />
          </div>
          <TextInput
            label="Erledigte Bestellungen bleiben sichtbar (Minuten)"
            value={archive}
            onChange={x => setArchive(x.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            className="max-w-xs"
            hint="So lange sehen Gäste und Kellner eine servierte Bestellung noch, bevor sie verschwindet."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <ColorField label="Vereinsfarbe 1 (Knöpfe, Fortschritt)" value={primary} onChange={setPrimary} />
            <ColorField label="Vereinsfarbe 2 (Auswahl, Hinweise)" value={secondary} onChange={setSecondary} />
          </div>
        </fieldset>
        {!ev.closed && (
          <div className="flex justify-end">
            <Button type="submit" busy={busy} disabled={!valid || !changed} icon={<FloppyDisk size={20} weight="bold" />}>Speichern</Button>
          </div>
        )}
      </form>
    </Card>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const ok = /^#[0-9a-f]{6}$/i.test(value);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[0.9375rem] font-bold text-ink-2">{label}</span>
      <div className="flex items-center gap-2">
        <input type="color" value={ok ? value : '#000000'} onChange={x => onChange(x.target.value.toUpperCase())} aria-label={label} className="size-12 shrink-0 cursor-pointer rounded-[12px] border-0 bg-surface-3 p-1" />
        <input className={cx(inputClass, 'font-mono uppercase')} value={value} onChange={x => onChange(x.target.value)} maxLength={7} aria-label={`${label} als Hex-Wert`} aria-invalid={!ok} />
      </div>
    </div>
  );
}

/** Folder name, event id and the command that builds this event's own site. */
function Publishing() {
  const ev = useEvent();
  const toast = useToast();
  const { busy, run } = useAction();
  const [slug, setSlug] = useState(ev.pub.slug ?? '');
  const valid = slug === '' || /^[A-Za-z0-9][A-Za-z0-9-]{2,39}$/.test(slug);
  const changed = slug !== (ev.pub.slug ?? '');
  const shown = ev.pub.slug ?? '<Ordner>';
  const cmd = `npm run build:event -- ${shown} ${ev.id}`;
  const copy = (text: string) => void copyText(text).then(ok => toast({ message: ok ? 'Kopiert' : 'Kopieren nicht möglich', tone: ok ? 'ok' : 'error' }));

  return (
    <Card title="Veröffentlichen" subtitle="Optional: jede Veranstaltung unter eigener Adresse. Nach dem Fest löschst du den Ordner – dann sind alle Links tot.">
      <form className="flex flex-col gap-4" onSubmit={e => { e.preventDefault(); if (valid && changed) void run(() => api.updateEvent({ eventId: ev.id, slug: slug || null }), 'Ordnername gespeichert'); }}>
        <div className="flex items-end gap-2">
          <TextInput label="Ordnername" value={slug} onChange={x => setSlug(x.target.value.replace(/\s+/g, '-'))} disabled={ev.closed} placeholder="Hochzeit-Meier" aria-invalid={!valid} className="flex-1" hint={valid ? `Adresse: ${location.origin}/${slug || '<Ordner>'}/` : '3–40 Zeichen: Buchstaben, Ziffern, „-“.'} />
          {!ev.closed && <Button type="submit" variant="secondary" busy={busy} disabled={!valid || !changed}>Speichern</Button>}
        </div>
      </form>
      {ev.pub.slug && !ev.closed && (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <ol className="list-decimal space-y-2 pl-5 text-ink-2 text-pretty marker:font-bold marker:text-ink-3">
            <li>
              Seite bauen (auf dem Rechner mit dem Projekt):
              <span className="mt-1.5 flex items-center gap-2">
                <code className="min-w-0 flex-1 overflow-x-auto rounded-[10px] bg-surface-3 px-3 py-2 text-[0.875rem] whitespace-nowrap text-ink">{cmd}</code>
                <Button variant="quiet" aria-label="Befehl kopieren" icon={<Copy size={18} weight="bold" />} onClick={() => copy(cmd)} className="min-h-11 px-3" />
              </span>
            </li>
            <li>Den Ordner <code className="text-ink">dist-events/{ev.pub.slug}</code> nach <code className="text-ink">/{ev.pub.slug}/</code> auf praesenzwert.de hochladen.</li>
            <li>Tisch-QR-Codes und Personal-Links (die zeigen schon auf diesen Ordner) verteilen.</li>
          </ol>
          <p className="text-[0.875rem] text-ink-3 text-pretty">Die so gebaute Seite funktioniert nur für diese Veranstaltung. Ordner löschen = Adressen tot; zusätzlich sperrt „Beenden“ alle Codes und Links in der Datenbank.</p>
        </div>
      )}
    </Card>
  );
}

function PinCard() {
  const { busy, run } = useAction();
  const toast = useToast();
  const [pin, setPin] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 8);
  const valid = pin.length >= 4 && next.length >= 4 && next === again;

  return (
    <Card title="Admin-PIN ändern" subtitle="4 bis 8 Ziffern. Die PIN wird nur als Hash auf dem Server gespeichert.">
      <form
        className="flex flex-col gap-4"
        onSubmit={e => {
          e.preventDefault();
          if (!valid) return;
          void run(() => api.changeAdminPin(pin, next)).then(ok => {
            if (ok) { setPin(''); setNext(''); setAgain(''); toast({ message: 'PIN geändert', tone: 'ok' }); }
          });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <TextInput label="Aktuelle PIN" type="password" inputMode="numeric" autoComplete="current-password" value={pin} onChange={e => setPin(digits(e.target.value))} />
          <TextInput label="Neue PIN" type="password" inputMode="numeric" autoComplete="new-password" value={next} onChange={e => setNext(digits(e.target.value))} />
          <TextInput label="Neue PIN wiederholen" type="password" inputMode="numeric" autoComplete="new-password" value={again} onChange={e => setAgain(digits(e.target.value))} aria-invalid={again !== '' && again !== next} />
        </div>
        <div className="flex justify-end"><Button type="submit" busy={busy} disabled={!valid}>PIN ändern</Button></div>
      </form>
    </Card>
  );
}
