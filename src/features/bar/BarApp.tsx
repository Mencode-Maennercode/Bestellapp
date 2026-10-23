import { ArrowCounterClockwise, CalendarBlank, LinkBreak, Prohibit, QrCode, SpeakerHigh, SpeakerSlash, WifiSlash } from '@phosphor-icons/react';
import { AnimatePresence } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { eventGate } from '@shared/event-window';
import { ALL_BARS, barLists, tally, type Entry, type TallyLine } from '@shared/staff-board';
import type { Catalog } from '@shared/types';
import { useNow } from '@/data/live';
import { useWakeLock } from '@/features/staff/device';
import { Age, Quiet, Sash, SystemStrip } from '@/features/staff/parts';
import { sound, useSoundReady } from '@/features/staff/sound';
import { useEventData, useOrderActions, useStaffSession, type EventData } from '@/features/staff/useStaff';
import { Badge, Button, Notice, ProductImage, Skeleton, applyAccent, cx } from '@/ui';
import { LinkSheet, SoldOutSheet } from './BarSheets';
import { BarTile } from './BarTile';

export function BarApp() {
  const session = useStaffSession('bar');
  const data = useEventData(session.status === 'ready' ? session.eventId : null, 'bar', session.status === 'ready' ? session.uid : null);
  const pub = data.status === 'ready' ? data.data.pub : null;
  useEffect(() => applyAccent(pub?.accent), [pub?.accent]);

  if (session.status === 'error')
    return (
      <Notice icon={<LinkBreak size={44} />} title="Kein Zugang" action={<Button variant="secondary" onClick={() => location.reload()}>Erneut versuchen</Button>}>
        {session.message}
      </Notice>
    );
  if (data.status === 'error')
    return (
      <Notice icon={<WifiSlash size={44} />} title="Zugang abgelaufen" action={<Button onClick={() => location.reload()}>Neu laden</Button>}>
        Der Personal-Link wurde erneuert oder die Veranstaltung ist vorbei. Bitte den aktuellen Link öffnen.
      </Notice>
    );
  if (session.status !== 'ready' || data.status !== 'ready') return <Loading />;
  if (eventGate(data.data.pub, Date.now()) === 'ended')
    return <Notice icon={<CalendarBlank size={44} />} title="Veranstaltung beendet">Danke für den Einsatz an der Theke!</Notice>;
  return <Bar eventId={session.eventId} token={session.token} data={data.data} />;
}

const BAR_KEY = 'barTab';
const SOUND_KEY = 'barSound';
const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
};

type Pane = 'board' | 'tally' | 'ready';

function Bar({ eventId, token, data }: { eventId: string; token: string; data: EventData }) {
  const now = useNow(1000);
  const soundReady = useSoundReady();
  const { run, busy } = useOrderActions(eventId);
  const barIds = useMemo(() => Object.keys(data.bars).sort(), [data.bars]);
  const multi = barIds.length > 1;
  const [barId, setBarId] = useState(() => store.get(`${BAR_KEY}:${eventId}`) ?? (multi ? ALL_BARS : barIds[0]));
  const current = barId === ALL_BARS || data.bars[barId] ? barId : (barIds[0] ?? ALL_BARS);
  const [chime, setChime] = useState(() => store.get(SOUND_KEY) !== '0');
  const [pane, setPane] = useState<Pane>('board');
  const [soldOut, setSoldOut] = useState(false);
  const [link, setLink] = useState(false);

  useWakeLock(true);

  const lists = useMemo(() => barLists(data.orders, current, data.bars), [data.orders, current, data.bars]);
  const sums = useMemo(() => tally(lists.todo, data.catalog), [lists.todo, data.catalog]);
  const soldOutCount = Object.values(data.catalog.products).filter(p => p.active && p.soldOut).length;

  // Chime for each new ticket on this board.
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    const ids = lists.todo.map(([id]) => id);
    if (!seen.current) {
      seen.current = new Set(ids);
      return;
    }
    const fresh = ids.some(id => !seen.current!.has(id));
    ids.forEach(id => seen.current!.add(id));
    if (fresh && chime && soundReady) sound.chime();
  }, [lists.todo, chime, soundReady]);

  useEffect(() => {
    document.title = lists.todo.length ? `(${lists.todo.length}) Theke` : 'Theke';
  }, [lists.todo.length]);

  const pick = (id: string) => {
    setBarId(id);
    store.set(`${BAR_KEY}:${eventId}`, id);
  };
  const label = (o: Entry[1]) => (o.type === 'tab' ? `Bon${o.note ? ` „${o.note}“` : ''}` : `Tisch ${o.tableLabel}`);
  const ready = (id: string) => void run(id, 'ready', `${label(data.orders[id])} fertig`);
  const soundOn = chime && soundReady;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 bg-bg/94 pt-[var(--safe-top)] backdrop-blur-md supports-[not(backdrop-filter:blur(1px))]:bg-bg">
        <Sash />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 gutter py-2.5">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[2rem] leading-none font-extrabold uppercase">Theke</h1>
            <p className="truncate text-[0.875rem] text-ink-3">{data.pub.name}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              variant={soldOutCount ? 'secondary' : 'quiet'}
              icon={<Prohibit size={20} weight="bold" />}
              onClick={() => setSoldOut(true)}
              
            >
              <span className="max-sm:sr-only">Ausverkauft</span>
              {soldOutCount > 0 && <Badge tone="late" className="num min-w-6 justify-center text-[0.9375rem]">{soldOutCount}</Badge>}
            </Button>
            <Button variant="quiet" icon={<QrCode size={20} weight="bold" />} onClick={() => setLink(true)}>
              <span className="max-sm:sr-only">Kellner-Link</span>
            </Button>
            <Button
              variant="quiet"
              aria-pressed={soundOn}
              aria-label={soundOn ? 'Ton aus' : 'Ton an'}
              icon={soundOn ? <SpeakerHigh size={20} weight="fill" /> : <SpeakerSlash size={20} weight="bold" />}
              className={cx(!soundOn && 'text-warn')}
              onClick={() => {
                const next = !soundOn;
                if (next) sound.unlock();
                setChime(next);
                store.set(SOUND_KEY, next ? '1' : '0');
                if (next) sound.chime();
              }}
            />
          </div>
          {multi && (
            <div role="tablist" aria-label="Theke wählen" className="no-scrollbar -mx-[var(--gutter)] flex w-[calc(100%+2*var(--gutter))] gap-1.5 overflow-x-auto px-[var(--gutter)] lg:mx-0 lg:w-auto lg:px-0">
              {[ALL_BARS, ...barIds].map(id => (
                <button
                  key={id}
                  role="tab"
                  type="button"
                  aria-selected={current === id}
                  onClick={() => pick(id)}
                  className={cx(
                    'min-h-11 shrink-0 rounded-full px-4 text-[0.9375rem] font-bold transition-colors',
                    current === id ? 'bg-ink text-bg' : 'bg-surface-1 text-ink-2 shadow-[var(--edge)] hover:text-ink',
                  )}
                >
                  {id === ALL_BARS ? 'Alle' : data.bars[id].name}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <SystemStrip system={data.system} className="gutter pt-3" />

      {/* Phones and portrait tablets switch panes; wide screens show everything side by side. */}
      <div role="tablist" aria-label="Ansicht" className="grid grid-cols-3 gap-1 gutter pt-3 lg:hidden">
        {([
          ['board', 'Bons', lists.todo.length],
          ['tally', 'Liste', sums.drinks.length],
          ['ready', 'Abholen', lists.ready.length],
        ] as const).map(([k, l, n]) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={pane === k}
            onClick={() => setPane(k)}
            className={cx(
              'flex min-h-12 items-center justify-center gap-1.5 rounded-[var(--radius-btn)] px-2 font-bold transition-colors',
              pane === k ? 'bg-surface-3 text-ink shadow-[var(--edge)]' : 'text-ink-3 hover:text-ink-2',
            )}
          >
            <span className="truncate">{l}</span>
            {n > 0 && <span className="num text-lg">{n}</span>}
          </button>
        ))}
      </div>

      <main className="grid flex-1 items-start gap-6 gutter pt-4 pb-[calc(var(--safe-bottom)+2rem)] lg:grid-cols-[minmax(0,1fr)_21rem]">
        <section aria-labelledby="h-board" className={cx(pane !== 'board' && 'max-lg:hidden')}>
          <h2 id="h-board" className="mb-3 flex items-baseline gap-3 font-display text-[2rem] leading-none font-extrabold uppercase max-lg:sr-only">
            Zu machen {lists.todo.length > 0 && <span className="num text-ink-3">{lists.todo.length}</span>}
          </h2>
          {lists.todo.length ? (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17.5rem),1fr))] items-start gap-3">
              <AnimatePresence initial={false}>
                {lists.todo.map(([id, o]) => (
                  <BarTile key={id} id={id} order={o} catalog={data.catalog} now={now} busy={busy[id]} onReady={ready} />
                ))}
              </AnimatePresence>
            </ul>
          ) : (
            <Quiet title="Alles raus">Neue Bestellungen erscheinen hier sofort, die älteste oben links.</Quiet>
          )}
        </section>

        <aside className={cx('flex flex-col gap-6 lg:sticky lg:top-[calc(var(--safe-top)+5.5rem)]', pane === 'board' && 'max-lg:hidden')}>
          <section aria-labelledby="h-tally" className={cx(pane === 'ready' && 'max-lg:hidden')}>
            <h2 id="h-tally" className="mb-3 max-lg:sr-only font-display text-[1.75rem] leading-none font-extrabold uppercase">Sammelliste</h2>
            <Tally drinks={sums.drinks} glasses={sums.glasses} catalog={data.catalog} />
          </section>
          <section aria-labelledby="h-ready" className={cx(pane === 'tally' && 'max-lg:hidden')}>
            <h2 id="h-ready" className="mb-3 max-lg:sr-only flex items-baseline gap-3 font-display text-[1.75rem] leading-none font-extrabold uppercase">
              Abholbereit {lists.ready.length > 0 && <span className="num text-ink-3">{lists.ready.length}</span>}
            </h2>
            {lists.ready.length ? (
              <ul className="flex flex-col gap-1.5">
                {lists.ready.map(([id, o]) => (
                  <li key={id} className="flex items-center gap-3 rounded-[var(--radius-btn)] bg-surface-1 py-2 pr-2 pl-3.5 shadow-[var(--edge)]">
                    <span className={cx('leading-none font-extrabold', o.type === 'tab' ? 'font-display text-xl uppercase' : 'num text-[1.875rem]')}>
                      {o.type === 'tab' ? 'Bon' : o.tableLabel}
                    </span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate font-bold">{o.claimedBy?.name ?? o.waiterName ?? 'Kellner gesucht'}</span>
                      <span className="block text-[0.875rem] text-ink-3">
                        wartet <Age since={o.readyAt ?? o.createdAt} now={now} className="text-[0.9375rem]" />
                      </span>
                    </span>
                    <Button
                      variant="quiet"
                      busy={busy[id]}
                      aria-label={`${label(o)} zurück aufs Board`}
                      icon={<ArrowCounterClockwise size={20} weight="bold" />}
                      onClick={() => void run(id, 'unready')}
                      className="min-h-11 px-3"
                    >
                      <span className="max-sm:sr-only">Zurück</span>
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-3">Fertige Bestellungen warten hier, bis der Kellner sie serviert.</p>
            )}
          </section>
        </aside>
      </main>

      <SoldOutSheet open={soldOut} onClose={() => setSoldOut(false)} eventId={eventId} catalog={data.catalog} />
      <LinkSheet open={link} onClose={() => setLink(false)} eventId={eventId} token={token} eventName={data.pub.name} slug={data.pub.slug} />
    </div>
  );
}

function Tally({ drinks, glasses, catalog }: { drinks: TallyLine[]; glasses: TallyLine[]; catalog: Catalog }) {
  if (!drinks.length && !glasses.length) return <p className="text-ink-3">Hier steht zusammengezählt, was gerade offen ist: „12× Kölsch, 4× Cola“.</p>;
  return (
    <div className="rounded-[var(--radius-card)] bg-surface-1 px-3 py-2 shadow-[var(--edge)]">
      <ul className="divide-y divide-line">
        {drinks.map(l => {
          const p = catalog.products[l.productId];
          return (
            <li key={l.productId} className="flex items-center gap-3 py-2">
              <ProductImage image={p?.image} categoryId={p?.categoryId ?? ''} sizes="40px" className="size-10 shrink-0 rounded-[10px]" />
              <span className="min-w-0 flex-1 truncate font-bold">{l.name}</span>
              <span className="num text-[2rem] leading-none font-extrabold">{l.qty}</span>
            </li>
          );
        })}
      </ul>
      {glasses.length > 0 && (
        <p className="border-t border-line py-2.5 text-ink-2">
          <span className="font-bold text-ink-3">Gläser </span>
          {glasses.map(g => `${g.qty}× ${g.name.replace(/\s*\(leer\)/i, '')}`).join(', ')}
        </p>
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="gutter pt-[calc(var(--safe-top)+1.25rem)]" aria-busy="true" aria-label="Laden">
      <Skeleton className="h-8 w-40" />
      <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(17.5rem,1fr))] gap-3">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-64" />)}
      </div>
    </div>
  );
}
