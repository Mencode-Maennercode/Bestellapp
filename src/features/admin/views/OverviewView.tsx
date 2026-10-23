import { CheckCircle, Circle, Play } from '@phosphor-icons/react';
import { useMemo } from 'react';
import { formatEUR } from '@shared/money';
import { ACTIVE_WAITER_MS } from '@shared/staff-board';
import type { Order, OrderStatus } from '@shared/types';
import { formatAge, urgencyFor } from '@shared/urgency';
import { api } from '@/data/api';
import { useNow, useOpenOrders } from '@/data/live';
import { Badge, Button, cx } from '@/ui';
import { useEvent } from '../context';
import { Card, Stat, STATUS_LABEL, statusTone, useAction } from '../ui';

type Go = (tab: 'karte' | 'tische' | 'personal' | 'einstellungen' | 'statistik') => void;

const statusText: Record<OrderStatus, string> = { new: 'neu', accepted: 'angenommen', ready: 'abholbereit', served: 'serviert', cancelled: 'storniert' };
const typeText = (o: Order) => (o.type === 'call' ? 'Kellnerruf' : 'Bestellung');

export function OverviewView({ onOpen }: { onOpen: Go }) {
  const ev = useEvent();
  const now = useNow(1000);
  const { busy, run } = useAction();
  const feeds = useMemo(() => [{ child: 'open' as const, value: true }], []);
  const orders = useOpenOrders(ev.id, feeds);

  const open = orders.status === 'ready' ? Object.entries(orders.value ?? {}) : [];
  // Quick bons ("Schnellbon") belong to their waiter: the organiser sees how many there are, not what is on them.
  const shared = open.filter(([, o]) => o.type !== 'tab').sort((a, b) => a[1].createdAt - b[1].createdAt);
  const tabs = open.length - shared.length;
  const waiting = shared.filter(([, o]) => !o.servedAt && !o.readyAt && o.type !== 'call');
  const oldest = shared[0]?.[1].createdAt;
  const online = Object.values(ev.waiters).filter(w => now - (w.lastSeen ?? 0) < ACTIVE_WAITER_MS).length;
  const total = ev.stats?.totalCents ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-[2.5rem] leading-none font-extrabold uppercase">{ev.pub.name}</h2>
        <Badge tone={statusTone(ev.pub.status)}>{STATUS_LABEL[ev.pub.status]}</Badge>
        {ev.pub.status === 'draft' && (
          <Button icon={<Play size={20} weight="fill" />} busy={busy} onClick={() => void run(() => api.updateEvent({ eventId: ev.id, status: 'live' }), 'Veranstaltung ist live')}>Live schalten</Button>
        )}
      </div>

      {ev.system.shutdown && <p role="status" className="rounded-[var(--radius-btn)] bg-late/16 px-4 py-3 font-bold text-[#ffc2bd]">Notfall-Stopp ist aktiv: Gäste können nichts bestellen.</p>}
      {!ev.system.shutdown && ev.system.ordersPaused && <p role="status" className="rounded-[var(--radius-btn)] bg-warn/14 px-4 py-3 font-bold text-[#ffd59a]">Gast-Bestellungen sind pausiert. Kellnerrufe und Kellner-Bestellungen laufen weiter.</p>}

      {ev.pub.status === 'draft' && <Checklist onOpen={onOpen} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Umsatz" value={formatEUR(total)} hint={`${ev.stats?.totalOrders ?? 0} abgeschlossene Bestellungen`} />
        <Stat label="Offene Aufträge" value={shared.length} hint={tabs ? `+ ${tabs} Schnellbon${tabs === 1 ? '' : 's'} bei den Kellnern` : `${waiting.length} warten auf die Theke`} />
        <Stat
          label="Längste Wartezeit"
          value={oldest ? formatAge(oldest, now) : '–'}
          tone={oldest ? (urgencyFor(oldest, now) === 'late' ? 'late' : urgencyFor(oldest, now) === 'warn' ? 'warn' : undefined) : undefined}
          hint="Minuten:Sekunden"
        />
        <Stat label="Kellner online" value={online} hint={`${Object.keys(ev.waiters).length} haben sich angemeldet`} />
      </div>

      <Card title="Offene Aufträge" subtitle="Ältester zuerst. Nichts verschwindet, bis es serviert ist.">
        {orders.status === 'loading' && <p className="text-ink-3">Laden …</p>}
        {orders.status === 'ready' && shared.length === 0 && <p className="py-6 text-center text-ink-3">Gerade nichts offen.</p>}
        {shared.length > 0 && (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left">
              <thead className="text-[0.875rem] text-ink-3">
                <tr>
                  <th className="px-1 pb-2 font-bold">Tisch</th>
                  <th className="px-1 pb-2 font-bold">Art</th>
                  <th className="px-1 pb-2 font-bold">Kellner</th>
                  <th className="px-1 pb-2 font-bold">Stand</th>
                  <th className="px-1 pb-2 text-right font-bold">Summe</th>
                  <th className="px-1 pb-2 text-right font-bold">Wartet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shared.map(([id, o]) => {
                  const u = urgencyFor(o.createdAt, now);
                  return (
                    <tr key={id}>
                      <td className="num px-1 py-2.5 text-[1.5rem] leading-none font-extrabold">{o.tableLabel ?? '–'}</td>
                      <td className="px-1 py-2.5">{typeText(o)}</td>
                      <td className="px-1 py-2.5 text-ink-2">{o.claimedBy?.name ?? <span className="text-warn">noch niemand</span>}</td>
                      <td className="px-1 py-2.5"><Badge tone={o.status === 'ready' ? 'accent' : 'neutral'}>{statusText[o.status]}</Badge></td>
                      <td className="num px-1 py-2.5 text-right text-lg font-bold">{o.type === 'call' ? '' : formatEUR(o.totalCents)}</td>
                      <td className={cx('num px-1 py-2.5 text-right text-xl font-bold', u === 'warn' && 'text-warn', u === 'late' && 'text-late')}>{formatAge(o.createdAt, now)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Checklist({ onOpen }: { onOpen: Go }) {
  const ev = useEvent();
  const hasTables = ev.pub.mode === 'noTables' || Object.keys(ev.tables).length > 0;
  const steps: { done: boolean; title: string; text: string; tab: Parameters<Go>[0]; cta: string }[] = [
    { done: Object.keys(ev.catalog.products).length > 0, title: 'Karte und Preise prüfen', text: 'Fotos, Preise, ausverkaufte Artikel.', tab: 'karte', cta: 'Karte öffnen' },
    ...(ev.pub.mode === 'tables'
      ? [{ done: hasTables, title: 'Tische anlegen und QR-Codes drucken', text: 'Jeder Tisch bekommt einen eigenen Code.', tab: 'tische' as const, cta: 'Tische öffnen' }]
      : []),
    { done: false, title: 'Links an Kellner und Theke schicken', text: 'Kellner- und Theken-Link sind getrennt.', tab: 'personal', cta: 'Personal öffnen' },
    { done: false, title: 'Live schalten', text: 'Ab dann können Gäste bestellen (eine Stunde vor Beginn bis eine Stunde nach Ende).', tab: 'einstellungen', cta: 'Zeiten prüfen' },
  ];
  return (
    <Card title="So geht's los" subtitle="Die Veranstaltung ist noch ein Entwurf – Gäste können noch nicht bestellen.">
      <ol className="divide-y divide-line">
        {steps.map((s, i) => (
          <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0">
            {s.done ? <CheckCircle size={26} weight="fill" className="shrink-0 text-ok" aria-label="erledigt" /> : <Circle size={26} className="shrink-0 text-ink-3" aria-hidden />}
            <div className="min-w-0 flex-1">
              <p className="font-bold">{s.title}</p>
              <p className="text-[0.9375rem] text-ink-3">{s.text}</p>
            </div>
            <Button variant="secondary" onClick={() => onOpen(s.tab)}>{s.cta}</Button>
          </li>
        ))}
      </ol>
    </Card>
  );
}
