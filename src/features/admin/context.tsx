import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Bar, Catalog, EventIndexEntry, EventPublic, Stats, SystemState, Table, WaiterProfile } from '@shared/types';
import { useLive } from '@/data/live';

export interface AdminEvent {
  id: string;
  pub: EventPublic;
  system: SystemState;
  catalog: Catalog;
  tables: Record<string, Table>;
  bars: Record<string, Bar>;
  waiters: Record<string, WaiterProfile>;
  stats: Stats | null;
  /** Current plain link tokens; gone once the event is closed. */
  tokens: { waiter?: string; bar?: string } | null;
  closed: boolean;
}

interface Ctx {
  events: [string, EventIndexEntry][];
  eventId: string | null;
  select: (id: string) => void;
  /** The selected event, once everything is loaded. */
  ev: AdminEvent | null;
  loading: boolean;
}

const AdminCtx = createContext<Ctx | null>(null);

export function useAdmin(): Ctx {
  const c = useContext(AdminCtx);
  if (!c) throw new Error('useAdmin outside AdminProvider');
  return c;
}

/** The selected event; only for screens rendered when one exists. */
export function useEvent(): AdminEvent {
  const { ev } = useAdmin();
  if (!ev) throw new Error('no event selected');
  return ev;
}

const KEY = 'adminEvent';
const read = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

/** Newest running event first, else the most recent one. */
function pickDefault(events: [string, EventIndexEntry][]): string | null {
  return (events.find(([, e]) => e.status === 'live') ?? events[0])?.[0] ?? null;
}

export function AdminProvider({ index, children }: { index: Record<string, EventIndexEntry>; children: ReactNode }) {
  const events = useMemo(() => Object.entries(index).sort((a, b) => b[1].startsAt - a[1].startsAt), [index]);
  const [chosen, setChosen] = useState<string | null>(read);
  const eventId = chosen && index[chosen] ? chosen : pickDefault(events);

  const select = useCallback((id: string) => {
    setChosen(id);
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const base = eventId ? `events/${eventId}` : null;
  const pub = useLive<EventPublic>(base && `${base}/public`);
  const system = useLive<SystemState>(base && `${base}/system`);
  const catalog = useLive<Catalog>(base && `${base}/catalog`);
  const tables = useLive<Record<string, Table>>(base && `${base}/tables`);
  const bars = useLive<Record<string, Bar>>(base && `${base}/bars`);
  const waiters = useLive<Record<string, WaiterProfile>>(base && `${base}/waiters`);
  const stats = useLive<Stats>(base && `${base}/stats`);
  const tokens = useLive<{ waiter?: string; bar?: string }>(eventId && `secrets/eventStaffToken/${eventId}`);

  const all = [pub, system, catalog, tables, bars, waiters, stats, tokens];
  const ready = !!eventId && all.every(l => l.status === 'ready') && pub.status === 'ready' && !!pub.value;

  const ev = useMemo<AdminEvent | null>(() => {
    if (!ready || !eventId || pub.status !== 'ready' || !pub.value) return null;
    const v = <T,>(l: { status: string; value?: T | null }): T | null => (l.status === 'ready' ? (l.value ?? null) : null);
    const cat = v(catalog);
    return {
      id: eventId,
      pub: pub.value,
      system: v(system) ?? { shutdown: false, ordersPaused: false },
      catalog: { categories: cat?.categories ?? {}, products: cat?.products ?? {} },
      tables: v(tables) ?? {},
      bars: v(bars) ?? {},
      waiters: v(waiters) ?? {},
      stats: v(stats),
      tokens: v(tokens),
      closed: pub.value.status === 'closed',
    };
  }, [ready, eventId, pub, system, catalog, tables, bars, waiters, stats, tokens]);

  return <AdminCtx.Provider value={{ events, eventId, select, ev, loading: !!eventId && !ev }}>{children}</AdminCtx.Provider>;
}
