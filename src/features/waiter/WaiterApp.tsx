import { BellRinging, CalendarBlank, CaretDown, LinkBreak, Plus, SpeakerSlash, Table as TableIcon, WifiSlash } from '@phosphor-icons/react';
import { ref, serverTimestamp, update } from 'firebase/database';
import { AnimatePresence } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { eventGate } from '@shared/event-window';
import { alarmCandidates, waiterLists, ACTIVE_WAITER_MS, type Entry } from '@shared/staff-board';
import { db } from '@/data/firebase';
import { useNow } from '@/data/live';
import { enablePush, pushState, useWakeLock, type PushState } from '@/features/staff/device';
import { Quiet, Sash, SystemStrip } from '@/features/staff/parts';
import { sound, useSoundReady } from '@/features/staff/sound';
import { sortedTables, useEventData, useOrderActions, useStaffSession, type EventData } from '@/features/staff/useStaff';
import { Button, Notice, Sheet, Skeleton, applyAccent, cx, useHideShellPhoto, useToast } from '@/ui';
import { AlarmOverlay } from './AlarmOverlay';
import { OrderCard, type Primary } from './OrderCard';
import { AlarmStep, NameStep, TablesStep } from './Setup';
import { TablePicker } from './TablePicker';
import { WaiterOrder, type OrderTarget } from './WaiterOrder';

interface Profile {
  name: string;
  tableIds: string[];
  tablesDone?: boolean;
  alarmAsked?: boolean;
}

const profileKey = (eventId: string) => `waiter:${eventId}`;

function loadProfile(eventId: string): Profile {
  try {
    return { name: '', tableIds: [], ...JSON.parse(localStorage.getItem(profileKey(eventId)) ?? '{}') };
  } catch {
    return { name: '', tableIds: [] };
  }
}

export function WaiterApp() {
  const session = useStaffSession('waiter');
  const data = useEventData(session.status === 'ready' ? session.eventId : null, 'waiter', session.status === 'ready' ? session.uid : null);
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
        Der Personal-Link wurde erneuert oder die Veranstaltung ist vorbei. Bitte den aktuellen Link vom Veranstalter öffnen.
      </Notice>
    );
  if (session.status !== 'ready' || data.status !== 'ready') return <Loading />;
  if (eventGate(data.data.pub, Date.now()) === 'ended')
    return <Notice icon={<CalendarBlank size={44} />} title="Veranstaltung beendet">Danke fürs Mitlaufen! Für die nächste Veranstaltung gibt es einen neuen Link.</Notice>;
  return <Waiter eventId={session.eventId} uid={session.uid} data={data.data} />;
}

function Waiter({ eventId, uid, data }: { eventId: string; uid: string; data: EventData }) {
  const [profile, setProfileState] = useState<Profile>(() => loadProfile(eventId));
  const setProfile = (p: Profile) => {
    setProfileState(p);
    try {
      localStorage.setItem(profileKey(eventId), JSON.stringify(p));
    } catch {
      /* storage blocked: profile lives for this visit */
    }
  };
  const noTables = data.pub.mode === 'noTables';
  const steps = noTables ? 2 : 3;

  // Colleagues present right now, for "auch bei Ben" in the table grid.
  const takenBy = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [wid, w] of Object.entries(data.waiters)) {
      if (wid === uid || Date.now() - (w.lastSeen ?? 0) > ACTIVE_WAITER_MS) continue;
      for (const t of Object.values(w.tableIds ?? {})) out[t] = out[t] ? `${out[t]}, ${w.name}` : w.name;
    }
    return out;
  }, [data.waiters, uid]);

  const named = profile.name.length > 0;
  // The profile is written as soon as there is a name, so the server can credit orders to it.
  useEffect(() => {
    if (!named) return;
    const write = () =>
      update(ref(db, `events/${eventId}/waiters/${uid}`), {
        name: profile.name,
        tableIds: noTables ? [] : profile.tableIds,
        lastSeen: serverTimestamp(),
      }).catch(() => {});
    void write();
    const id = setInterval(write, 60_000);
    return () => clearInterval(id);
  }, [eventId, uid, named, profile.name, profile.tableIds, noTables]);

  if (!named) return <NameStep eventName={data.pub.name} steps={steps} initial="" onDone={name => setProfile({ ...profile, name })} />;
  if (!noTables && !profile.tablesDone)
    return (
      <TablesStep
        eventName={data.pub.name}
        steps={steps}
        tables={data.tables}
        initial={profile.tableIds}
        takenBy={takenBy}
        onDone={tableIds => setProfile({ ...profile, tableIds, tablesDone: true })}
      />
    );
  if (!profile.alarmAsked)
    return (
      <AlarmStep
        eventName={data.pub.name}
        steps={steps}
        onDone={withAlarm => {
          if (withAlarm) {
            sound.test();
            void enablePush(eventId, uid);
          }
          setProfile({ ...profile, alarmAsked: true });
        }}
      />
    );

  return <Board eventId={eventId} uid={uid} data={data} profile={profile} setProfile={setProfile} takenBy={takenBy} />;
}

interface BoardProps {
  eventId: string;
  uid: string;
  data: EventData;
  profile: Profile;
  setProfile: (p: Profile) => void;
  takenBy: Record<string, string>;
}

function Board({ eventId, uid, data, profile, setProfile, takenBy }: BoardProps) {
  const now = useNow(1000);
  const toast = useToast();
  const soundReady = useSoundReady();
  const { run, busy } = useOrderActions(eventId);
  const [target, setTarget] = useState<OrderTarget | null>(null);
  const [more, setMore] = useState<string | null>(null);
  const [me, setMe] = useState(false);
  const [pickTable, setPickTable] = useState(false);
  const noTables = data.pub.mode === 'noTables';
  const myTables = noTables ? [] : profile.tableIds.filter(id => data.tables[id]);
  const tablesKey = myTables.join(',');
  const meRef = useMemo(() => ({ uid, tableIds: tablesKey ? tablesKey.split(',') : [] }), [uid, tablesKey]);

  useWakeLock(true);
  useHideShellPhoto(); // the photo belongs to the setup steps only

  const lists = useMemo(() => waiterLists(data.orders, meRef, data.waiters, now), [data.orders, meRef, data.waiters, now]);

  // Alarm: ring for orders that arrive while the app is open; existing ones are just listed.
  const seen = useRef<Set<string> | null>(null);
  const [alerts, setAlerts] = useState<string[]>([]);
  useEffect(() => {
    const candidates = alarmCandidates(data.orders, meRef);
    if (!seen.current) {
      seen.current = new Set(Object.keys(data.orders));
      return;
    }
    const fresh = candidates.filter(id => !seen.current!.has(id));
    Object.keys(data.orders).forEach(id => seen.current!.add(id));
    if (fresh.length) setAlerts(a => [...a, ...fresh]);
  }, [data.orders, meRef]);
  const activeAlerts = alerts.filter(id => data.orders[id]?.open && !data.orders[id].claimedBy);
  const ringing = activeAlerts.length > 0;
  useEffect(() => {
    if (ringing && soundReady) sound.startAlarm();
    else sound.stopAlarm();
  }, [ringing, soundReady]);
  useEffect(() => () => sound.stopAlarm(), []);

  // Soft chime + toast when the bar finished one of my orders.
  const readySeen = useRef<Set<string> | null>(null);
  useEffect(() => {
    const ready = Object.entries(data.orders).filter(([, o]) => o.open && o.readyAt);
    if (!readySeen.current) {
      readySeen.current = new Set(ready.map(([id]) => id));
      return;
    }
    for (const [id, o] of ready) {
      if (readySeen.current.has(id)) continue;
      readySeen.current.add(id);
      if (o.claimedBy?.uid !== uid) continue;
      sound.chime();
      toast({ message: o.type === 'tab' ? `Bon${o.note ? ` „${o.note}“` : ''} ist fertig` : `Tisch ${o.tableLabel} ist fertig an der Theke`, tone: 'info' });
    }
  }, [data.orders, uid, toast]);

  useEffect(() => {
    const n = lists.mine.filter(([, o]) => !o.claimedBy).length + lists.orphan.length;
    document.title = n ? `(${n}) Kellner` : 'Kellner';
  }, [lists]);

  const act = (id: string, p: Primary) => void run(id, p.action, p.done);
  const finish = async (id: string, action: 'unclaim' | 'cancel', message: string) => {
    if (!(await run(id, action))) return;
    toast({ message, tone: 'info' });
    setMore(null);
  };
  const claimFromAlarm = async (id: string) => {
    if (await run(id, 'claim', `Tisch ${data.orders[id]?.tableLabel} übernommen`)) setAlerts(a => a.filter(x => x !== id));
  };

  if (target) return <WaiterOrder eventId={eventId} catalog={data.catalog} target={target} onClose={() => setTarget(null)} />;

  const tableLabel = (id: string) => data.tables[id]?.label ?? '?';
  const moreOrder = more ? data.orders[more] : null;
  const cards = (entries: Entry[], muted = false) => (
    <ul className="flex flex-col gap-2.5">
      <AnimatePresence initial={false}>
        {entries.map(([id, o]) => (
          <OrderCard key={id} id={id} order={o} catalog={data.catalog} now={now} myUid={uid} busy={busy[id]} muted={muted} onAction={act} onMore={setMore} />
        ))}
      </AnimatePresence>
    </ul>
  );

  return (
    <>
      <header className="sticky top-0 z-30 bg-bg/94 pt-[var(--safe-top)] backdrop-blur-md supports-[not(backdrop-filter:blur(1px))]:bg-bg">
        <Sash />
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 gutter">
          <button type="button" onClick={() => setMe(true)} className="-ml-2 flex min-h-12 min-w-0 items-center gap-3 rounded-[12px] px-2 text-left hover:bg-surface-1">
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-accent font-display text-xl font-extrabold text-accent-ink uppercase">
              {profile.name.slice(0, 1)}
            </span>
            <span className="min-w-0">
              <span className="block truncate leading-tight font-bold">{profile.name}</span>
              <span className="block truncate text-[0.875rem] leading-tight text-ink-3">
                {noTables ? 'Schnellbons' : myTables.length ? `Tische ${myTables.map(tableLabel).join(' · ')}` : 'Keine festen Tische'}
              </span>
            </span>
            <CaretDown size={16} weight="bold" className="shrink-0 text-ink-3" />
          </button>
          <div className="ml-auto shrink-0">
            {soundReady ? (
              <span className="flex items-center gap-1.5 text-[0.875rem] font-bold text-ok" title="Alarm ist an">
                <BellRinging size={20} weight="fill" /> <span className="max-[380px]:sr-only">Alarm an</span>
              </span>
            ) : (
              <button type="button" onClick={() => sound.test()} className="flex min-h-11 items-center gap-1.5 rounded-full bg-late px-3.5 text-[0.875rem] font-bold text-[#1a0605]">
                <SpeakerSlash size={18} weight="bold" /> Ton an
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl gutter pb-[calc(var(--safe-bottom)+7rem)]">
        <SystemStrip system={data.system} className="mt-3" />

        <section aria-labelledby="h-mine" className="pt-5">
          <h2 id="h-mine" className="mb-3 flex items-baseline gap-3 font-display text-[2rem] leading-none font-extrabold uppercase">
            Meine Aufträge
            {lists.mine.length > 0 && <span className="num text-ink-3">{lists.mine.length}</span>}
          </h2>
          {lists.mine.length ? (
            cards(lists.mine)
          ) : (
            <Quiet title="Alles ruhig">
              {noTables ? 'Tippe unten auf „Bon“, um einen Schnellbon anzulegen.' : 'Neue Bestellungen und Rufe deiner Tische erscheinen hier, mit Ton und Vollbild-Alarm.'}
            </Quiet>
          )}
        </section>

        {lists.orphan.length > 0 && (
          <section aria-labelledby="h-orphan" className="pt-8">
            <h2 id="h-orphan" className="font-display text-[1.625rem] leading-none font-extrabold text-warn uppercase">Ohne Kellner</h2>
            <p className="mt-1.5 mb-3 text-ink-2">Für diese Tische ist gerade niemand eingetragen. Wer Zeit hat, übernimmt.</p>
            {cards(lists.orphan)}
          </section>
        )}

        {lists.colleagues.length > 0 && (
          <details className="group pt-8">
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 font-bold text-ink-2 [&::-webkit-details-marker]:hidden">
              <CaretDown size={18} weight="bold" className="transition-transform group-open:rotate-180" />
              Meine Tische bei Kollegen <span className="num text-lg">{lists.colleagues.length}</span>
            </summary>
            <div className="pt-2">{cards(lists.colleagues, true)}</div>
          </details>
        )}
      </main>

      <nav aria-label="Neue Bestellung" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/94 pb-[var(--safe-bottom)] backdrop-blur-md supports-[not(backdrop-filter:blur(1px))]:bg-bg">
        <div className="mx-auto flex max-w-3xl items-center gap-2 py-2.5 gutter">
          {myTables.length > 0 && (
            <div className="no-scrollbar -my-1 flex min-w-0 flex-1 gap-2 overflow-x-auto py-1">
              {myTables.map(id => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTarget({ kind: 'table', tableId: id, label: tableLabel(id) })}
                  aria-label={`Bestellung für Tisch ${tableLabel(id)}`}
                  className="num grid min-h-14 min-w-14 shrink-0 place-items-center rounded-[var(--radius-btn)] px-3 text-[1.75rem] leading-none font-extrabold surface-3 active:scale-95 transition-transform"
                >
                  {tableLabel(id)}
                </button>
              ))}
            </div>
          )}
          {/* Outside the scrolling row, so it is never cut off; icon only next to my own tables. */}
          {!noTables && (
            <button
              type="button"
              onClick={() => setPickTable(true)}
              aria-label={myTables.length ? 'Anderer Tisch' : undefined}
              title={myTables.length ? 'Anderer Tisch' : undefined}
              className={cx(
                'flex min-h-14 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-btn)] font-bold text-ink-2 hover:text-ink surface-1',
                myTables.length ? 'min-w-14' : 'flex-1 px-3.5',
              )}
            >
              <TableIcon size={22} weight="bold" /> {!myTables.length && 'Tisch wählen'}
            </button>
          )}
          <Button size="lg" icon={<Plus size={22} weight="bold" />} onClick={() => setTarget({ kind: 'tab' })} className={cx('shrink-0', noTables && 'flex-1')}>
            {noTables ? 'Neuer Schnellbon' : 'Bon'}
          </Button>
        </div>
      </nav>

      <AlarmOverlay
        current={activeAlerts[0] ? [activeAlerts[0], data.orders[activeAlerts[0]]] : null}
        more={activeAlerts.length - 1}
        now={now}
        busy={!!(activeAlerts[0] && busy[activeAlerts[0]])}
        onClaim={claimFromAlarm}
        onLater={id => setAlerts(a => a.filter(x => x !== id))}
      />

      <MoreSheet
        id={more}
        order={moreOrder}
        busy={!!(more && busy[more])}
        onClose={() => setMore(null)}
        onUnclaim={id => void finish(id, 'unclaim', 'Freigegeben – wieder offen für alle')}
        onCancel={id => void finish(id, 'cancel', 'Storniert')}
        onReorder={o => {
          setMore(null);
          if (o.tableId) setTarget({ kind: 'table', tableId: o.tableId, label: o.tableLabel ?? tableLabel(o.tableId) });
        }}
        myUid={uid}
      />

      <Sheet open={pickTable} onClose={() => setPickTable(false)} title="Für welchen Tisch?">
        <div className="pb-2">
          <TablePicker
            tables={data.tables}
            value={[]}
            onChange={() => {}}
            onPick={id => {
              setPickTable(false);
              setTarget({ kind: 'table', tableId: id, label: tableLabel(id) });
            }}
          />
        </div>
      </Sheet>

      <MeSheet
        open={me}
        onClose={() => setMe(false)}
        eventId={eventId}
        uid={uid}
        data={data}
        profile={profile}
        setProfile={setProfile}
        takenBy={takenBy}
      />
    </>
  );
}

function MoreSheet({ id, order, busy, myUid, onClose, onUnclaim, onCancel, onReorder }: {
  id: string | null;
  order: EventData['orders'][string] | null;
  busy: boolean;
  myUid: string;
  onClose: () => void;
  onUnclaim: (id: string) => void;
  onCancel: (id: string) => void;
  onReorder: (o: EventData['orders'][string]) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  useEffect(() => setConfirm(false), [id]);
  const title = order ? (order.type === 'tab' ? `Bon${order.note ? ` · ${order.note}` : ''}` : `Tisch ${order.tableLabel}`) : '';
  return (
    <Sheet open={!!(id && order)} onClose={onClose} title={title} subtitle={order?.type === 'call' ? 'Kellnerruf' : undefined}>
      {id && order && (
        <div className="flex flex-col gap-2.5 pb-2">
          {order.tableId && order.type !== 'call' && (
            <Button variant="secondary" size="lg" onClick={() => onReorder(order)}>Für diesen Tisch nachbestellen</Button>
          )}
          {order.claimedBy?.uid === myUid && order.type !== 'tab' && (
            <Button variant="secondary" size="lg" busy={busy} onClick={() => onUnclaim(id)}>Abgeben – wieder für alle offen</Button>
          )}
          {confirm ? (
            <div className="rounded-[var(--radius-card)] bg-late/12 p-4">
              <p className="font-bold text-[#ffc2bd]">{order.type === 'call' ? 'Ruf verwerfen?' : 'Wirklich stornieren?'} Das zählt nicht in der Statistik und lässt sich nicht rückgängig machen.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => setConfirm(false)}>Nein</Button>
                <Button variant="danger" busy={busy} onClick={() => onCancel(id)}>Ja, stornieren</Button>
              </div>
            </div>
          ) : (
            <Button variant="quiet" size="lg" className="text-late hover:text-late" onClick={() => setConfirm(true)}>
              {order.type === 'call' ? 'Ruf verwerfen' : 'Stornieren'}
            </Button>
          )}
        </div>
      )}
    </Sheet>
  );
}

function MeSheet({ open, onClose, eventId, uid, data, profile, setProfile, takenBy }: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  uid: string;
  data: EventData;
  profile: Profile;
  setProfile: (p: Profile) => void;
  takenBy: Record<string, string>;
}) {
  const [name, setName] = useState(profile.name);
  const [ids, setIds] = useState(profile.tableIds);
  const [push, setPush] = useState<PushState>(pushState);
  useEffect(() => {
    if (open) {
      setName(profile.name);
      setIds(profile.tableIds);
      setPush(pushState());
    }
  }, [open, profile.name, profile.tableIds]);
  const noTables = data.pub.mode === 'noTables';
  const save = () => {
    setProfile({ ...profile, name: name.trim() || profile.name, tableIds: ids });
    onClose();
  };
  const pushText: Record<PushState, string> = {
    on: 'An – Meldung auch bei gesperrtem Handy.',
    off: 'Aus – nur Alarm, solange die Seite offen ist.',
    denied: 'Im Browser blockiert. In den Website-Einstellungen erlauben.',
    unsupported: 'Auf diesem Gerät nicht verfügbar. Seite offen lassen.',
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Ich"
      subtitle={data.pub.name}
      footer={<Button size="lg" className="w-full" onClick={save}>Speichern</Button>}
    >
      <div className="flex flex-col gap-6 pb-2">
        <label className="block">
          <span className="mb-1.5 block font-bold">Name</span>
          <input
            value={name}
            maxLength={40}
            onChange={e => setName(e.target.value)}
            className="min-h-14 w-full rounded-[var(--radius-btn)] bg-surface-3 px-4 text-lg font-bold shadow-[var(--edge)] outline-none focus-visible:outline-2 focus-visible:outline-accent-2"
          />
        </label>
        {!noTables && (
          <div>
            <p className="mb-2 font-bold">Meine Tische</p>
            <TablePicker tables={data.tables} value={ids} onChange={setIds} takenBy={takenBy} />
          </div>
        )}
        <div>
          <p className="mb-2 font-bold">Alarm</p>
          <div className="grid gap-2">
            <Button variant="secondary" icon={<BellRinging size={20} weight="fill" />} onClick={() => sound.test()}>Ton testen</Button>
            <div className="rounded-[var(--radius-btn)] bg-surface-1 px-4 py-3 shadow-[var(--edge)]">
              <p className="font-bold">Benachrichtigungen</p>
              <p className="mt-0.5 text-[0.9375rem] text-ink-3">{pushText[push]}</p>
              {push === 'off' && (
                <Button className="mt-3 w-full" variant="secondary" onClick={async () => setPush(await enablePush(eventId, uid))}>Erlauben</Button>
              )}
            </div>
          </div>
        </div>
        <p className="text-[0.9375rem] text-ink-3">
          Tische: {sortedTables(data.tables).length} · Kollegen online: {Object.entries(data.waiters).filter(([w, p]) => w !== uid && Date.now() - (p.lastSeen ?? 0) < ACTIVE_WAITER_MS).length}
        </p>
      </div>
    </Sheet>
  );
}

function Loading() {
  return (
    <div className="mx-auto max-w-3xl gutter pt-[calc(var(--safe-top)+1.5rem)]" aria-busy="true" aria-label="Laden">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <Skeleton className="h-5 w-36 rounded-full" />
      </div>
      <Skeleton className="mt-8 h-8 w-52" />
      <div className="mt-4 flex flex-col gap-2.5">
        {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-36" />)}
      </div>
    </div>
  );
}
