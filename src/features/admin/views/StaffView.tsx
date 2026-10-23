import { ArrowsClockwise, Copy, Plus, ShareNetwork, Trash } from '@phosphor-icons/react';
import { ref, remove, set, update } from 'firebase/database';
import { useEffect, useMemo, useState } from 'react';
import { ACTIVE_WAITER_MS } from '@shared/staff-board';
import { slugify, uniqueId } from '@shared/slug';
import type { Bar, StaffRole, WaiterProfile } from '@shared/types';
import { api } from '@/data/api';
import { db } from '@/data/firebase';
import { useNow } from '@/data/live';
import { barUrl, waiterUrl } from '@/data/links';
import { TablePicker } from '@/features/waiter/TablePicker';
import { Badge, Button, cx, Sheet, useToast } from '@/ui';
import { useEvent } from '../context';
import { qrSvg } from '../qr';
import { Card, ConfirmSheet, copyText, inputClass, TextInput, useAction } from '../ui';

export function StaffView() {
  const ev = useEvent();
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-[2.5rem] leading-none font-extrabold uppercase">Personal</h2>
        <p className="mt-2 max-w-[62ch] text-ink-2 text-pretty">
          Kellner und Theke bekommen <strong className="text-ink">je einen eigenen Link</strong>. Die Theke sieht nur, was für sie bestimmt ist – die privaten Schnellbons der Kellner bleiben bei den Kellnern.
        </p>
      </div>
      {ev.closed ? (
        <p role="status" className="rounded-[var(--radius-btn)] bg-surface-2 px-4 py-3 font-bold text-ink-2">Beendete Veranstaltung: alle Links sind gelöscht und gesperrt.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <LinkCard role="waiter" />
          <LinkCard role="bar" />
        </div>
      )}
      <Waiters />
      <Bars />
    </div>
  );
}

const ROLE_TEXT: Record<StaffRole, { title: string; hint: string; rotate: string }> = {
  waiter: { title: 'Kellner-Link', hint: 'Per WhatsApp an das Serviceteam. Jeder gibt seinen Namen ein und wählt seine Tische.', rotate: 'Alle Kellner-Geräte werden sofort abgemeldet und brauchen den neuen Link. Die Theke bleibt angemeldet.' },
  bar: { title: 'Theken-Link', hint: 'Nur für die Geräte hinter der Theke. Zeigt die Bons der Theke, nicht die privaten Schnellbons.', rotate: 'Alle Theken-Geräte werden sofort abgemeldet und brauchen den neuen Link. Die Kellner bleiben angemeldet.' },
};

function LinkCard({ role }: { role: StaffRole }) {
  const ev = useEvent();
  const toast = useToast();
  const { busy, run } = useAction();
  const [confirm, setConfirm] = useState(false);
  const [svg, setSvg] = useState('');
  const [big, setBig] = useState(false);
  const token = ev.tokens?.[role];
  const url = token ? (role === 'waiter' ? waiterUrl(ev.pub.slug, token) : barUrl(ev.pub.slug, token)) : '';
  const t = ROLE_TEXT[role];

  useEffect(() => {
    // A failed load (e.g. tab open across a new upload) shows a hint instead of an empty white box.
    if (url) void qrSvg(url).then(setSvg, () => setSvg('<p style="font:600 13px/1.3 sans-serif;color:#555;text-align:center;padding-top:30%">QR-Code nicht geladen.<br>Seite neu laden.</p>'));
    else setSvg('');
  }, [url]);

  const share = () => navigator.share?.({ title: `${t.title} · ${ev.pub.name}`, text: `${t.title} für ${ev.pub.name}`, url }).catch(() => {});

  return (
    <Card title={t.title} subtitle={t.hint}>
      {!token ? (
        <p className="text-ink-3">Kein Link vorhanden.</p>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <button
            type="button"
            onClick={() => setBig(true)}
            aria-label={`${t.title} als großen QR-Code zeigen`}
            className="aspect-square w-36 shrink-0 self-center rounded-[var(--radius-btn)] bg-white p-2 sm:self-start [&_svg]:size-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <div className="min-w-0 flex-1 space-y-3">
            <input readOnly value={url} onFocus={e => e.currentTarget.select()} aria-label={t.title} className={cx(inputClass, 'text-[0.8125rem] text-ink-2')} />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" icon={<Copy size={20} weight="bold" />} onClick={() => void copyText(url).then(ok => toast({ message: ok ? 'Link kopiert' : 'Kopieren nicht möglich', tone: ok ? 'ok' : 'error' }))}>Kopieren</Button>
              {'share' in navigator && <Button variant="secondary" icon={<ShareNetwork size={20} weight="bold" />} onClick={share}>Teilen</Button>}
              <Button variant="quiet" icon={<ArrowsClockwise size={20} weight="bold" />} onClick={() => setConfirm(true)}>Erneuern</Button>
            </div>
            <p className="text-[0.875rem] text-ink-3 text-pretty">Nicht an Gäste weitergeben. Der Link gilt nur bis eine Stunde nach Ende der Veranstaltung.</p>
          </div>
        </div>
      )}

      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`${t.title} erneuern?`}
        confirmLabel="Neuen Link erzeugen"
        busy={busy}
        onConfirm={() => void run(() => api.rotateStaffLink(ev.id, role), 'Neuer Link erzeugt').then(ok => ok && setConfirm(false))}
      >
        <p>{t.rotate}</p>
        <p>Der alte Link funktioniert danach nirgends mehr.</p>
      </ConfirmSheet>

      <Sheet open={big} onClose={() => setBig(false)} title={t.title} subtitle={ev.pub.name}>
        <div className="flex justify-center pb-3">
          <div className="aspect-square w-full max-w-[22rem] rounded-[var(--radius-card)] bg-white p-3 [&_svg]:size-full" role="img" aria-label={`QR-Code ${t.title}`} dangerouslySetInnerHTML={{ __html: svg }} />
        </div>
      </Sheet>
    </Card>
  );
}

function Waiters() {
  const ev = useEvent();
  const now = useNow(15_000);
  const { run } = useAction();
  const [edit, setEdit] = useState<string | null>(null);
  const list = useMemo(() => Object.entries(ev.waiters).sort((a, b) => (b[1].lastSeen ?? 0) - (a[1].lastSeen ?? 0)), [ev.waiters]);
  const labels = (w: WaiterProfile) => (w.tableIds ?? []).map(id => ev.tables[id]?.label).filter(Boolean).join(', ');

  return (
    <Card title="Kellner" subtitle={list.length ? 'Wer sich mit dem Link angemeldet hat – und welche Tische er bedient.' : 'Noch niemand angemeldet. Sobald Kellner den Link öffnen, erscheinen sie hier.'}>
      {list.length > 0 && (
        <ul className="divide-y divide-line">
          {list.map(([uid, w]) => {
            const online = now - (w.lastSeen ?? 0) < ACTIVE_WAITER_MS;
            return (
              <li key={uid} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 first:pt-0 last:pb-0">
                <span aria-label={online ? 'online' : 'offline'} className={cx('size-3 shrink-0 rounded-full', online ? 'bg-ok' : 'bg-surface-3')} />
                <div className="min-w-0 flex-1 basis-40 leading-tight">
                  <p className="truncate text-lg font-bold">{w.name}</p>
                  <p className="truncate text-[0.9375rem] text-ink-3">{labels(w) ? `Tische ${labels(w)}` : 'Keine Tische gewählt'}</p>
                </div>
                {w.fcmToken ? <Badge tone="accent">Push an</Badge> : <Badge>kein Push</Badge>}
                {!ev.closed && <Button variant="secondary" onClick={() => setEdit(uid)} className="min-h-11">Tische</Button>}
                {!ev.closed && (
                  <Button variant="quiet" aria-label={`${w.name} abmelden und entfernen`} icon={<Trash size={18} weight="bold" />} onClick={() => void run(() => remove(ref(db, `events/${ev.id}/waiters/${uid}`)), `${w.name} entfernt`)} className="min-h-11 px-3" />
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={`Tische von ${edit ? ev.waiters[edit]?.name : ''}`} subtitle="Der Kellner sieht die Änderung sofort">
        {edit && ev.waiters[edit] && (
          <div className="pb-2">
            <TablePicker
              tables={ev.tables}
              value={ev.waiters[edit].tableIds ?? []}
              onChange={ids => void run(() => set(ref(db, `events/${ev.id}/waiters/${edit}/tableIds`), ids))}
            />
          </div>
        )}
      </Sheet>
    </Card>
  );
}

function Bars() {
  const ev = useEvent();
  const { run } = useAction();
  const [edit, setEdit] = useState<string | null>(null);
  const [name, setName] = useState('');
  const bars = Object.entries(ev.bars).sort((a, b) => a[1].name.localeCompare(b[1].name, 'de'));
  const base = `events/${ev.id}/bars`;

  const add = async () => {
    const n = name.trim();
    if (!n) return;
    const id = uniqueId(slugify(n), Object.keys(ev.bars));
    if (await run(() => set(ref(db, `${base}/${id}`), { name: n, tableIds: [] } satisfies Bar), 'Theke angelegt')) setName('');
  };

  return (
    <Card
      title="Theken"
      subtitle="Mit mehreren Theken bekommt jede Bestellung genau eine – nach Tischen verteilt. Eine Theke ohne Tische bedient alle übrigen."
    >
      <ul className="divide-y divide-line">
        {bars.map(([id, b]) => {
          const tables = (b.tableIds ?? []).map(t => ev.tables[t]?.label).filter(Boolean);
          return (
            <li key={id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 first:pt-0">
              <div className="min-w-0 flex-1 basis-40 leading-tight">
                <p className="truncate text-lg font-bold">{b.name}</p>
                <p className="truncate text-[0.9375rem] text-ink-3">{tables.length ? `Tische ${tables.join(', ')}` : 'Alle übrigen Tische'}</p>
              </div>
              {!ev.closed && <Button variant="secondary" onClick={() => setEdit(id)} className="min-h-11">Bearbeiten</Button>}
            </li>
          );
        })}
      </ul>
      {!ev.closed && (
        <form className="mt-3 flex gap-2 border-t border-line pt-3" onSubmit={e => { e.preventDefault(); void add(); }}>
          <input className={inputClass} value={name} onChange={e => setName(e.target.value)} maxLength={30} placeholder="Weitere Theke, z. B. Theke Bühne" aria-label="Name der neuen Theke" />
          <Button type="submit" variant="secondary" disabled={!name.trim()} icon={<Plus size={20} weight="bold" />}>Anlegen</Button>
        </form>
      )}

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit ? ev.bars[edit]?.name ?? '' : ''} subtitle="Welche Tische bedient diese Theke?">
        {edit && ev.bars[edit] && (
          <div className="flex flex-col gap-4 pb-2">
            <TextInput
              label="Name"
              defaultValue={ev.bars[edit].name}
              maxLength={30}
              onBlur={e => {
                const v = e.target.value.trim();
                if (v && v !== ev.bars[edit].name) void run(() => update(ref(db, `${base}/${edit}`), { name: v }));
              }}
            />
            {ev.pub.mode === 'tables' && (
              <TablePicker
                tables={ev.tables}
                value={ev.bars[edit].tableIds ?? []}
                takenBy={Object.fromEntries(bars.filter(([id]) => id !== edit).flatMap(([, b]) => (b.tableIds ?? []).map(t => [t, b.name])))}
                onChange={ids => void run(() => set(ref(db, `${base}/${edit}/tableIds`), ids))}
              />
            )}
            {bars.length > 1 && (
              <Button
                variant="quiet"
                icon={<Trash size={18} weight="bold" />}
                className="self-start text-late"
                onClick={() => void run(() => remove(ref(db, `${base}/${edit}`)), 'Theke entfernt').then(ok => ok && setEdit(null))}
              >
                Theke entfernen
              </Button>
            )}
          </div>
        )}
      </Sheet>
    </Card>
  );
}
