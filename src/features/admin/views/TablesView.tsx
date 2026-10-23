import { ArrowsClockwise, Copy, Printer, QrCode, Plus, X } from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/data/api';
import { guestUrl } from '@/data/links';
import { Button, cx, Sheet, useToast } from '@/ui';
import { useEvent } from '../context';
import { byLabel, printQrSheets, qrSvg } from '../qr';
import { Card, ConfirmSheet, copyText, inputClass, TextInput, useAction } from '../ui';

interface Row {
  id?: string;
  label: string;
}

const sameRows = (a: Row[], b: Row[]) => a.length === b.length && a.every((r, i) => r.id === b[i].id && r.label === b[i].label);

export function TablesView() {
  const ev = useEvent();
  const toast = useToast();
  const { busy, run } = useAction();

  const saved = useMemo<Row[]>(
    () => Object.entries(ev.tables).sort((a, b) => a[1].sort - b[1].sort || byLabel(a[1].label, b[1].label)).map(([id, t]) => ({ id, label: t.label })),
    [ev.tables],
  );
  const [rows, setRows] = useState<Row[]>(saved);
  const dirty = !sameRows(rows, saved);
  useEffect(() => {
    if (!dirty) setRows(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-sync only while nothing is being edited
  }, [saved]);

  const [label, setLabel] = useState('');
  const [from, setFrom] = useState('1');
  const [to, setTo] = useState('');
  const [regen, setRegen] = useState(false);
  const [single, setSingle] = useState<string | null>(null);

  const taken = new Set(rows.map(r => r.label.toLowerCase()));
  const add = (labels: string[]) => {
    const fresh = labels.map(l => l.trim()).filter(l => l && l.length <= 12 && !taken.has(l.toLowerCase()));
    if (!fresh.length) return;
    setRows(r => [...r, ...fresh.map(l => ({ label: l }))].sort((a, b) => byLabel(a.label, b.label)));
  };

  if (ev.pub.mode === 'noTables')
    return (
      <Card title="Ohne Tische" subtitle="Diese Veranstaltung braucht keine Tisch-QR-Codes.">
        <p className="text-ink-2 text-pretty">Die Kellner starten direkt mit Schnellbons. Für eine Veranstaltung mit Tischen lege eine neue an und wähle „Mit Tischen“.</p>
      </Card>
    );

  const n = Number(to) - Number(from) + 1;
  const rangeOk = Number.isInteger(Number(from)) && Number.isInteger(Number(to)) && n >= 1 && n <= 300 && Number(from) >= 0;
  const removed = saved.filter(s => !rows.some(r => r.id === s.id));
  const printable = !dirty && saved.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[2.5rem] leading-none font-extrabold uppercase">Tische & QR</h2>
          <p className="mt-2 max-w-[60ch] text-ink-2 text-pretty">Jeder Tisch hat einen eigenen Code, der nur für diese Veranstaltung gilt.</p>
        </div>
        <Button
          size="lg"
          icon={<Printer size={22} weight="bold" />}
          disabled={!printable || ev.closed}
          onClick={() => void printQrSheets(ev).then(ok => !ok && toast({ message: 'Das Druckfenster wurde blockiert. Bitte Pop-ups für diese Seite erlauben.', tone: 'error' }))}
        >
          QR-Bögen drucken
        </Button>
      </div>
      {dirty && <p role="status" className="rounded-[var(--radius-btn)] bg-warn/14 px-4 py-3 font-bold text-[#ffd59a]">Ungespeicherte Änderungen – erst speichern, dann drucken.</p>}
      {ev.closed && <p role="status" className="rounded-[var(--radius-btn)] bg-surface-2 px-4 py-3 font-bold text-ink-2">Beendete Veranstaltung: Tische und Codes sind gesperrt.</p>}

      {!ev.closed && (
        <Card title="Tische anlegen" subtitle="Einzeln (auch „56a“) oder ein ganzer Bereich auf einmal.">
          <div className="grid gap-4 md:grid-cols-2">
            <form className="flex items-end gap-2" onSubmit={e => { e.preventDefault(); add([label]); setLabel(''); }}>
              <TextInput label="Einzelner Tisch" value={label} onChange={e => setLabel(e.target.value)} maxLength={12} placeholder="z. B. 56a oder VIP" className="min-w-0 flex-1" />
              <Button type="submit" variant="secondary" disabled={!label.trim()} icon={<Plus size={20} weight="bold" />}>Hinzu</Button>
            </form>
            <form className="flex items-end gap-2" onSubmit={e => { e.preventDefault(); if (rangeOk) { add(Array.from({ length: n }, (_, i) => String(Number(from) + i))); setTo(''); } }}>
              <TextInput label="Bereich von" value={from} onChange={e => setFrom(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="min-w-0 flex-1 sm:w-24 sm:flex-none" />
              <TextInput label="bis" value={to} onChange={e => setTo(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="60" className="min-w-0 flex-1 sm:w-24 sm:flex-none" />
              <Button type="submit" variant="secondary" disabled={!rangeOk} icon={<Plus size={20} weight="bold" />}>{rangeOk ? `${n} Tische` : 'Hinzu'}</Button>
            </form>
          </div>
        </Card>
      )}

      <Card
        title={`${rows.length} ${rows.length === 1 ? 'Tisch' : 'Tische'}`}
        action={
          !ev.closed && (
            <div className="flex gap-2">
              {dirty && <Button variant="quiet" onClick={() => setRows(saved)}>Verwerfen</Button>}
              <Button busy={busy} disabled={!dirty} onClick={() => void run(() => api.setTables(ev.id, rows), 'Tische gespeichert')}>Speichern</Button>
            </div>
          )
        }
      >
        {rows.length === 0 ? (
          <p className="py-6 text-center text-ink-3">Noch keine Tische. Lege sie oben an.</p>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(5.25rem,1fr))] gap-3">
            {rows.map((r, i) => (
              <li key={r.id ?? `n-${r.label}`} className={cx('relative flex min-h-16 items-center justify-center rounded-[var(--radius-btn)] bg-surface-3 shadow-[var(--edge)]', !r.id && 'outline-2 -outline-offset-2 outline-accent-2')}>
                <button
                  type="button"
                  disabled={!r.id}
                  onClick={() => r.id && setSingle(r.id)}
                  aria-label={r.id ? `QR-Code von Tisch ${r.label} anzeigen` : `Tisch ${r.label} (noch nicht gespeichert)`}
                  className="num grid size-full place-items-center px-1 text-[1.875rem] leading-none font-extrabold disabled:cursor-default"
                >
                  {r.label}
                </button>
                {!ev.closed && (
                  <button
                    type="button"
                    aria-label={`Tisch ${r.label} entfernen`}
                    onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}
                    className="group absolute -top-3 -right-3 z-10 grid size-11 place-items-center rounded-full"
                  >
                    {/* 44 px hit area, 28 px circle; it reaches into the 12 px grid gap, never into the next tile. */}
                    <span className="grid size-7 place-items-center rounded-full bg-surface-1 text-ink-3 shadow-[var(--edge)] group-hover:text-late">
                      <X size={14} weight="bold" />
                    </span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {removed.length > 0 && <p className="mt-3 text-[0.9375rem] text-warn text-pretty">Beim Speichern werden {removed.length} Tisch{removed.length === 1 ? '' : 'e'} samt Code gelöscht: {removed.map(r => r.label).join(', ')}.</p>}
      </Card>

      {!ev.closed && saved.length > 0 && (
        <Card title="Codes erneuern" subtitle="Falls QR-Codes in falsche Hände geraten sind. Alle bisherigen Codes verlieren sofort ihre Gültigkeit.">
          <Button variant="secondary" icon={<ArrowsClockwise size={20} weight="bold" />} onClick={() => setRegen(true)}>Neue Codes für alle Tische</Button>
        </Card>
      )}

      <ConfirmSheet
        open={regen}
        onClose={() => setRegen(false)}
        title="Neue Codes erzeugen?"
        confirmLabel="Ja, erneuern"
        busy={busy}
        onConfirm={() => void run(() => api.regenerateGuestCodes(ev.id), 'Neue Codes erzeugt – bitte neu drucken').then(ok => ok && setRegen(false))}
      >
        <p>Alle bereits gedruckten QR-Bögen funktionieren danach <strong className="text-ink">nicht mehr</strong>. Du musst sie neu ausdrucken und an den Tischen austauschen.</p>
      </ConfirmSheet>

      <SingleQr tableId={single} onClose={() => setSingle(null)} />
    </div>
  );
}

function SingleQr({ tableId, onClose }: { tableId: string | null; onClose: () => void }) {
  const ev = useEvent();
  const toast = useToast();
  const table = tableId ? ev.tables[tableId] : undefined;
  const url = table ? guestUrl(ev.pub.slug, table.guestCode) : '';
  const [svg, setSvg] = useState('');
  useEffect(() => {
    if (url) void qrSvg(url).then(setSvg, () => setSvg(''));
  }, [url]);

  return (
    <Sheet open={!!table} onClose={onClose} title={`Tisch ${table?.label ?? ''}`} subtitle="So sieht der Code für diesen Tisch aus">
      <div className="flex flex-col items-center gap-4 pb-2">
        <div className="aspect-square w-full max-w-[17rem] rounded-[var(--radius-card)] bg-white p-3 [&_svg]:size-full" role="img" aria-label={`QR-Code Tisch ${table?.label}`} dangerouslySetInnerHTML={{ __html: svg }} />
        <input readOnly value={url} onFocus={e => e.currentTarget.select()} aria-label="Adresse" className={cx(inputClass, 'text-[0.875rem] text-ink-2')} />
        <div className="grid w-full grid-cols-2 gap-2">
          <Button variant="secondary" icon={<Copy size={20} weight="bold" />} onClick={() => void copyText(url).then(ok => toast({ message: ok ? 'Adresse kopiert' : 'Kopieren nicht möglich', tone: ok ? 'ok' : 'error' }))}>Kopieren</Button>
          <Button variant="secondary" icon={<QrCode size={20} weight="bold" />} onClick={() => window.open(url, '_blank', 'noopener')}>Testen</Button>
        </div>
      </div>
    </Sheet>
  );
}
