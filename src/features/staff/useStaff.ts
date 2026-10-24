import { useCallback, useEffect, useMemo, useState } from 'react';
import type { OrderAction } from '@shared/order-lifecycle';
import type { Bar, Catalog, EventPublic, Order, SystemState, Table, WaiterProfile } from '@shared/types';
import { ApiError, api } from '@/data/api';
import { useLive, useOpenOrders } from '@/data/live';
import { isOtherEvent } from '@/data/lock';
import { ensureStaffSession, forgetStaffLink, staffLinkToken, type StaffRole } from '@/data/session';
import { useToast } from '@/ui';

export type StaffSession =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; eventId: string; uid: string; token: string };

const PAGE: Record<StaffRole, string> = { waiter: 'kellner', bar: 'theke' };
const DEAD_LINK = new Set(['linkInvalid', 'linkRotated', 'eventEnded']);

/**
 * Silent login from the link; the link stays in the address bar so a reload or bookmark keeps working.
 * A link of the other role (bar link on the waiter page and vice versa) is forwarded to its own page.
 */
export function useStaffSession(role: StaffRole, attempt = 0): StaffSession {
  const [s, setS] = useState<StaffSession>({ status: 'loading' });
  useEffect(() => {
    setS({ status: 'loading' });
    const token = staffLinkToken(role);
    if (!token) {
      setS({ status: 'error', message: 'Bitte den Personal-Link vom Veranstalter öffnen.' });
      return;
    }
    ensureStaffSession(token, role, attempt > 0)
      .then(r => {
        if (r.role !== role) {
          location.replace(`${import.meta.env.BASE_URL}${PAGE[r.role]}/#${token}`);
          return;
        }
        if (isOtherEvent(r.eventId)) {
          setS({ status: 'error', message: 'Dieser Link gehört zu einer anderen Veranstaltung. Bitte den aktuellen Link vom Veranstalter öffnen.' });
          return;
        }
        setS({ status: 'ready', eventId: r.eventId, uid: r.uid, token });
      })
      .catch((e: Error) => {
        if (e instanceof ApiError && DEAD_LINK.has(e.reason)) forgetStaffLink(role);
        setS({ status: 'error', message: e instanceof ApiError ? e.message : 'Verbindung fehlgeschlagen. Bitte erneut versuchen.' });
      });
  }, [role, attempt]);
  return s;
}

const MAX_RECOVERIES = 3;

/**
 * Session plus live data. A listener error usually means the device's login went stale
 * (phone slept past the token lifetime, another tab signed in with a different link):
 * re-login silently from the stored link and resubscribe before giving up.
 */
export function useStaffLive(role: StaffRole) {
  const [attempt, setAttempt] = useState(0);
  const [fails, setFails] = useState(0);
  const session = useStaffSession(role, attempt);
  const ready = session.status === 'ready';
  const data = useEventData(ready ? session.eventId : null, role, ready ? session.uid : null);
  useEffect(() => {
    if (data.status === 'ready') setFails(0);
    if (data.status === 'error' && fails < MAX_RECOVERIES) {
      setFails(f => f + 1);
      setAttempt(a => a + 1);
    }
  }, [data.status]); // eslint-disable-line react-hooks/exhaustive-deps
  const gaveUp = data.status === 'error' && fails >= MAX_RECOVERIES;
  return { session, data: data.status === 'error' && !gaveUp ? ({ status: 'loading' } as const) : data };
}

export interface EventData {
  pub: EventPublic;
  system: SystemState;
  catalog: Catalog;
  tables: Record<string, Table>;
  bars: Record<string, Bar>;
  waiters: Record<string, WaiterProfile>;
  orders: Record<string, Order>;
}

/**
 * Everything staff screens read, live. `error` means the session no longer has access.
 * What is read depends on the role: the bar never gets the waiter list nor private tabs.
 */
export function useEventData(
  eventId: string | null,
  role: StaffRole,
  uid: string | null,
): { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: EventData } {
  const ev = eventId ? `events/${eventId}` : null;
  const pub = useLive<EventPublic>(ev && `${ev}/public`);
  const system = useLive<SystemState>(ev && `${ev}/system`);
  const catalog = useLive<Catalog>(ev && `${ev}/catalog`);
  const tables = useLive<Record<string, Table>>(ev && `${ev}/tables`);
  const bars = useLive<Record<string, Bar>>(ev && `${ev}/bars`);
  const waiters = useLive<Record<string, WaiterProfile>>(role === 'waiter' ? ev && `${ev}/waiters` : null);
  const feeds = useMemo(
    () =>
      role === 'bar'
        ? [{ child: 'bFeed' as const, value: 'bar' }]
        : [{ child: 'wFeed' as const, value: 'all' }, { child: 'wFeed' as const, value: `w:${uid}` }],
    [role, uid],
  );
  const orders = useOpenOrders(uid ? eventId : null, feeds);
  const all = [pub, system, catalog, tables, bars, waiters, orders];
  if (all.some(l => l.status === 'error')) return { status: 'error' };
  if (
    pub.status !== 'ready' || system.status !== 'ready' || catalog.status !== 'ready' || tables.status !== 'ready' ||
    bars.status !== 'ready' || (role === 'waiter' && waiters.status !== 'ready') || orders.status !== 'ready' || !pub.value || !catalog.value
  ) {
    return { status: 'loading' };
  }
  return {
    status: 'ready',
    data: {
      pub: pub.value,
      system: system.value ?? { shutdown: false, ordersPaused: false },
      catalog: { categories: catalog.value.categories ?? {}, products: catalog.value.products ?? {} },
      tables: tables.value ?? {},
      bars: bars.value ?? { main: { name: 'Theke', tableIds: [] } },
      waiters: waiters.status === 'ready' ? (waiters.value ?? {}) : {},
      orders: orders.value ?? {},
    },
  };
}

const UNDO: Partial<Record<OrderAction, OrderAction>> = { claim: 'unclaim', serve: 'unserve', ready: 'unready' };

/** Runs order actions with a busy flag per order and a 5 s "Rückgängig" toast. */
export function useOrderActions(eventId: string) {
  const toast = useToast();
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const run = useCallback(
    async (orderId: string, action: OrderAction, message?: string): Promise<boolean> => {
      setBusy(b => ({ ...b, [orderId]: true }));
      try {
        await api.orderAction(eventId, orderId, action);
        const undo = UNDO[action];
        if (message) {
          toast({
            message,
            tone: 'ok',
            undo: undo ? () => void api.orderAction(eventId, orderId, undo).catch((e: Error) => toast({ message: e.message, tone: 'error' })) : undefined,
          });
        }
        return true;
      } catch (e) {
        toast({ message: (e as Error).message, tone: 'error' });
        return false;
      } finally {
        setBusy(({ [orderId]: _, ...rest }) => rest);
      }
    },
    [eventId, toast],
  );

  return { run, busy };
}

/** Tables sorted like the printed plan (sort, then label with numbers in order: 7, 12, 56a). */
export function sortedTables(tables: Record<string, Table>): [string, Table][] {
  return Object.entries(tables).sort(
    (a, b) => a[1].sort - b[1].sort || a[1].label.localeCompare(b[1].label, 'de', { numeric: true }),
  );
}
