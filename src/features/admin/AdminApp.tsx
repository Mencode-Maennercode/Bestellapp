import {
  CalendarBlank, ChartBar, Gauge, GearSix, Megaphone, Pause, Prohibit, SignOut, Storefront, Table as TableIcon, UsersThree,
  type Icon,
} from '@phosphor-icons/react';
import { ref, set } from 'firebase/database';
import { useEffect, useState, type ReactNode } from 'react';
import type { EventIndexEntry } from '@shared/types';
import { db } from '@/data/firebase';
import { useLive } from '@/data/live';
import { hasAdminSession, logout } from '@/data/session';
import { applyAccent, Button, cx, Notice, Skeleton, useToast } from '@/ui';
import { AdminProvider, useAdmin } from './context';
import { Login } from './Login';
import { ConfirmSheet, STATUS_LABEL, useAction } from './ui';
import { EventsView } from './views/EventsView';
import { MessagesView } from './views/MessagesView';
import { OverviewView } from './views/OverviewView';
import { ProductsView } from './views/ProductsView';
import { SettingsView } from './views/SettingsView';
import { StaffView } from './views/StaffView';
import { StatsView } from './views/StatsView';
import { TablesView } from './views/TablesView';

type TabId = 'uebersicht' | 'veranstaltungen' | 'karte' | 'tische' | 'personal' | 'nachrichten' | 'statistik' | 'einstellungen';

const TABS: { id: TabId; label: string; icon: Icon }[] = [
  { id: 'uebersicht', label: 'Übersicht', icon: Gauge },
  { id: 'veranstaltungen', label: 'Veranstaltungen', icon: CalendarBlank },
  { id: 'karte', label: 'Karte', icon: Storefront },
  { id: 'tische', label: 'Tische & QR', icon: TableIcon },
  { id: 'personal', label: 'Personal', icon: UsersThree },
  { id: 'nachrichten', label: 'Nachrichten', icon: Megaphone },
  { id: 'statistik', label: 'Statistik', icon: ChartBar },
  { id: 'einstellungen', label: 'Einstellungen', icon: GearSix },
];

const isTab = (v: string): v is TabId => TABS.some(t => t.id === v);

export function AdminApp() {
  const [session, setSession] = useState<'checking' | 'out' | 'in'>('checking');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    void hasAdminSession().then(ok => setSession(ok ? 'in' : 'out'));
  }, []);

  if (session === 'checking') return <Loading />;
  if (session === 'out')
    return <Login expired={expired} onDone={() => { setExpired(false); setSession('in'); }} />;
  return <Authenticated onExpired={() => { setExpired(true); setSession('out'); void logout(); }} />;
}

function Authenticated({ onExpired }: { onExpired: () => void }) {
  const index = useLive<Record<string, EventIndexEntry>>('eventIndex');
  useEffect(() => {
    if (index.status === 'error') onExpired();
  }, [index.status, onExpired]);

  if (index.status !== 'ready') return <Loading />;
  return (
    <AdminProvider index={index.value ?? {}}>
      <Shell />
    </AdminProvider>
  );
}

function Shell() {
  const { events, eventId, select, ev, loading } = useAdmin();
  const [tab, setTab] = useState<TabId>(() => {
    const h = location.hash.slice(1);
    return isTab(h) ? h : events.length ? 'uebersicht' : 'veranstaltungen';
  });

  useEffect(() => {
    history.replaceState(null, '', `#${tab}`);
    document.title = `${TABS.find(t => t.id === tab)?.label} · Verwaltung`;
  }, [tab]);
  useEffect(() => applyAccent(ev?.pub.accent), [ev?.pub.accent]);

  const body = (): ReactNode => {
    if (tab === 'veranstaltungen') return <EventsView onOpen={t => setTab(t)} />;
    if (!eventId)
      return <Notice title="Noch keine Veranstaltung" action={<Button onClick={() => setTab('veranstaltungen')}>Veranstaltung anlegen</Button>}>Lege zuerst eine Veranstaltung an – dann geht es hier weiter.</Notice>;
    if (loading || !ev) return <div className="space-y-3" aria-busy="true"><Skeleton className="h-28" /><Skeleton className="h-64" /></div>;
    switch (tab) {
      case 'uebersicht': return <OverviewView onOpen={t => setTab(t)} />;
      case 'karte': return <ProductsView />;
      case 'tische': return <TablesView />;
      case 'personal': return <StaffView />;
      case 'nachrichten': return <MessagesView />;
      case 'statistik': return <StatsView />;
      case 'einstellungen': return <SettingsView onLogout={() => { void logout().then(() => location.reload()); }} />;
    }
  };

  return (
    <div className="min-h-dvh pb-[calc(var(--safe-bottom)+3rem)]">
      <header className="sticky top-0 z-30 bg-bg/94 pt-[var(--safe-top)] backdrop-blur-md supports-[not(backdrop-filter:blur(1px))]:bg-bg">
        <div aria-hidden className="flex h-1"><span className="flex-1 bg-accent" /><span className="flex-1 bg-accent-2" /></div>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 gutter py-2.5">
          <h1 className="font-display text-[2rem] leading-none font-extrabold uppercase">Verwaltung</h1>
          {events.length > 0 && (
            <select
              aria-label="Veranstaltung wählen"
              value={eventId ?? ''}
              onChange={e => select(e.target.value)}
              className="min-h-11 max-w-[min(100%,22rem)] min-w-0 flex-1 appearance-none truncate rounded-full bg-surface-3 px-4 font-bold shadow-[var(--edge)] sm:flex-none"
            >
              {events.map(([id, e]) => (
                <option key={id} value={id}>{e.name} · {STATUS_LABEL[e.status]}</option>
              ))}
            </select>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            {ev && !ev.closed && <EmergencyControls />}
            <Button variant="quiet" aria-label="Abmelden" icon={<SignOut size={20} weight="bold" />} onClick={() => void logout().then(() => location.reload())} className="px-3" />
          </div>
        </div>
        <nav aria-label="Bereiche" className="border-b border-line">
          <div role="tablist" className="no-scrollbar mx-auto flex max-w-6xl gap-1 overflow-x-auto gutter pb-2">
            {TABS.map(({ id, label, icon: I }) => (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cx(
                  'flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 font-bold transition-colors',
                  tab === id ? 'bg-ink text-bg' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                )}
              >
                <I size={18} weight={tab === id ? 'fill' : 'bold'} aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl gutter pt-5">{body()}</main>
    </div>
  );
}

/** Notfall-Stopp and Bestellsperre are reachable from every screen. */
function EmergencyControls() {
  const { ev } = useAdmin();
  const toast = useToast();
  const { busy, run } = useAction();
  const [confirm, setConfirm] = useState(false);
  if (!ev) return null;
  const { shutdown, ordersPaused } = ev.system;
  const write = (key: 'shutdown' | 'ordersPaused', value: boolean, ok: string) =>
    run(() => set(ref(db, `events/${ev.id}/system/${key}`), value), ok);

  return (
    <>
      <Button
        variant={ordersPaused ? 'primary' : 'quiet'}
        aria-pressed={ordersPaused}
        busy={busy}
        icon={<Pause size={20} weight={ordersPaused ? 'fill' : 'bold'} />}
        onClick={() => void write('ordersPaused', !ordersPaused, ordersPaused ? 'Bestellungen laufen wieder' : 'Gast-Bestellungen pausiert')}
        className={cx('px-3', ordersPaused ? '!bg-warn !text-[#1d1204]' : '')}
      >
        <span className="max-md:sr-only">{ordersPaused ? 'Sperre aufheben' : 'Bestellsperre'}</span>
      </Button>
      <Button
        variant={shutdown ? 'danger' : 'quiet'}
        aria-pressed={shutdown}
        busy={busy}
        icon={<Prohibit size={20} weight="bold" />}
        onClick={() => (shutdown ? void write('shutdown', false, 'System wieder in Betrieb') : setConfirm(true))}
        className="px-3"
      >
        <span className="max-md:sr-only">{shutdown ? 'Wieder starten' : 'Notfall-Stopp'}</span>
      </Button>
      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Notfall-Stopp?"
        confirmLabel="Jetzt stoppen"
        busy={busy}
        onConfirm={() => void write('shutdown', true, 'Notfall-Stopp ist aktiv').then(ok => ok && (setConfirm(false), toast({ message: 'Gäste sehen: „System außer Betrieb“.', tone: 'info' })))}
      >
        <p>Gäste können dann <strong className="text-ink">nichts mehr bestellen und keinen Kellner rufen</strong>. Eure Kellner und die Theke arbeiten weiter.</p>
        <p>Rückgängig mit „Wieder starten“.</p>
      </ConfirmSheet>
    </>
  );
}

function Loading() {
  return (
    <div className="mx-auto max-w-6xl gutter pt-[calc(var(--safe-top)+1.25rem)]" aria-busy="true" aria-label="Laden">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="mt-6 h-72" />
    </div>
  );
}

