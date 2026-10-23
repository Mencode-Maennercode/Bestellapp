import { DownloadSimple, Star } from '@phosphor-icons/react';
import { useMemo } from 'react';
import { commissionCents, consistency, linesToCsv, productLines, tableLines, waiterLines, type StatLine } from '@shared/admin-stats';
import { formatEUR } from '@shared/money';
import { slugify } from '@shared/slug';
import type { Feedback } from '@shared/types';
import { useLive } from '@/data/live';
import { Button } from '@/ui';
import { useEvent } from '../context';
import { Card, formatWhen, Stat } from '../ui';

function download(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function StatsView() {
  const ev = useEvent();
  const stats = ev.stats;
  const products = useMemo(() => productLines(stats), [stats]);
  const tables = useMemo(() => tableLines(stats, ev.tables), [stats, ev.tables]);
  const waiters = useMemo(() => waiterLines(stats), [stats]);
  const check = useMemo(() => consistency(stats), [stats]);
  const total = stats?.totalCents ?? 0;
  const orders = stats?.totalOrders ?? 0;
  const file = (part: string) => `${slugify(ev.pub.name)}-${part}.csv`;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-[2.5rem] leading-none font-extrabold uppercase">Statistik</h2>
        <p className="mt-2 text-ink-2">
          {ev.pub.name}. Gezählt wird, sobald die Theke „Fertig“ meldet oder serviert wurde – storniert oder rückgängig gemacht zieht exakt wieder ab.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Umsatz" value={formatEUR(total)} />
        <Stat label="Bestellungen" value={orders} />
        <Stat label="Ø Bestellung" value={orders ? formatEUR(Math.round(total / orders)) : '–'} />
        <Stat label="PräsenzWert-Anteil 1,5 %" value={formatEUR(commissionCents(total))} hint="vom Gesamtumsatz" />
      </div>

      {!check.ok && (
        <p role="alert" className="rounded-[var(--radius-btn)] bg-warn/14 px-4 py-3 font-bold text-[#ffd59a] text-pretty">
          Die Teilsummen passen nicht zum Gesamtumsatz (Artikel {formatEUR(check.products)}, Tische {formatEUR(check.tables)}, Kellner {formatEUR(check.waiters)}, gesamt {formatEUR(check.total)}).
          Bei übernommenen Altdaten ist das normal; bei einer neuen Veranstaltung bitte melden.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Breakdown title="Top-Artikel" unit={() => 'Stück'} lines={products} onCsv={() => download(file('artikel'), linesToCsv('Artikel', 'Stück', products))} />
        <Breakdown title="Umsatz je Tisch" unit={n => (n === 1 ? 'Bestellung' : 'Bestellungen')} lines={tables} onCsv={() => download(file('tische'), linesToCsv('Tisch', 'Bestellungen', tables))} />
        <Breakdown title="Umsatz je Kellner" unit={n => (n === 1 ? 'Bestellung' : 'Bestellungen')} lines={waiters} onCsv={() => download(file('kellner'), linesToCsv('Kellner', 'Bestellungen', waiters))} />
        <Ratings eventId={ev.id} />
      </div>
    </div>
  );
}

function Breakdown({ title, unit, lines, onCsv }: { title: string; unit: (n: number) => string; lines: StatLine[]; onCsv: () => void }) {
  const max = Math.max(1, ...lines.map(l => l.cents));
  return (
    <Card
      title={title}
      action={<Button variant="quiet" icon={<DownloadSimple size={20} weight="bold" />} disabled={!lines.length} onClick={onCsv} className="min-h-11">CSV</Button>}
    >
      {lines.length === 0 ? (
        <p className="py-4 text-center text-ink-3">Noch nichts gebucht.</p>
      ) : (
        <ol className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto pr-1">
          {lines.map(l => (
            <li key={l.id} className="grid grid-cols-[1fr_auto] items-baseline gap-x-3">
              <span className="truncate font-bold">{l.name}</span>
              <span className="num text-lg font-bold">{formatEUR(l.cents)}</span>
              <span className="relative col-span-2 mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
                <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${Math.max(2, (l.cents / max) * 100)}%` }} />
              </span>
              <span className="col-span-2 text-[0.8125rem] text-ink-3">{l.count} {unit(l.count)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function Ratings({ eventId }: { eventId: string }) {
  const all = useLive<Record<string, Feedback>>('feedback');
  const list = all.status === 'ready' ? Object.values(all.value ?? {}).filter(f => f.eventId === eventId).sort((a, b) => b.createdAt - a.createdAt) : [];
  const avg = list.length ? list.reduce((n, f) => n + f.rating, 0) / list.length : 0;
  return (
    <Card title="Bewertungen" subtitle={list.length ? `${list.length} Rückmeldungen · Ø ${avg.toFixed(1).replace('.', ',')} von 5` : undefined}>
      {list.length === 0 ? (
        <p className="py-4 text-center text-ink-3">Noch keine Rückmeldungen von Gästen.</p>
      ) : (
        <ul className="flex max-h-[28rem] flex-col gap-3 overflow-y-auto pr-1">
          {list.map((f, i) => (
            <li key={i} className="rounded-[var(--radius-btn)] bg-surface-2 px-3 py-2.5">
              <p className="flex items-center gap-2">
                <span className="flex" aria-label={`${f.rating} von 5 Sternen`}>
                  {Array.from({ length: 5 }, (_, s) => <Star key={s} size={16} weight={s < f.rating ? 'fill' : 'regular'} className={s < f.rating ? 'text-accent-2' : 'text-ink-3'} />)}
                </span>
                <span className="text-[0.8125rem] text-ink-3">{formatWhen(f.createdAt)}</span>
              </p>
              {f.message && <p className="mt-1 text-pretty">{f.message}</p>}
              {(f.name || f.email) && <p className="mt-1 text-[0.875rem] text-ink-3">{[f.name, f.email].filter(Boolean).join(' · ')}</p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
