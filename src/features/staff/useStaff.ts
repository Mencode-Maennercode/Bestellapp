import { useCallback, useEffect, useState } from 'react';
import type { OrderAction } from '@shared/order-lifecycle';
import type { Bar, Catalog, EventPublic, Order, SystemState, Table, WaiterProfile } from '@shared/types';
import { ApiError, api } from '@/data/api';
import { useLive, useOpenOrders } from '@/data/live';
import { ensureStaffSession, staffLinkToken } from '@/data/session';
import { useToast } from '@/ui';

export type StaffSession =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; eventId: string; uid: string; token: string };

/** Silent login from the link; afterwards the token leaves the address bar (screenshots, shoulder views). */
export function useStaffSession(): StaffSession {
  const [s, setS] = useState<StaffSession>({ status: 'loading' });
  useEffect(() => {
    const token = staffLinkToken();
    if (!token) {
      setS({ status: 'error', message: 'Bitte den Personal-Link vom Veranstalter öffnen.' });
      return;
    }
    ensureStaffSession(token)
      .then(r => {
        history.replaceState(null, '', location.pathname);
        setS({ status: 'ready', ...r, token });
      })
      .catch((e: Error) => setS({ status: 'error', message: e instanceof ApiError ? e.message : 'Verbindung fehlgeschlagen. Bitte erneut versuchen.' }));
  }, []);
  return s;
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

/** Everything staff screens read, live. `error` means the session no longer has access. */
export function useEventData(eventId: string | null): { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: EventData } {
  const ev = eventId ? `events/${eventId}` : null;
  const pub = useLive<EventPublic>(ev && `${ev}/public`);
  const system = useLive<SystemState>(ev && `${ev}/system`);
  const catalog = useLive<Catalog>(ev && `${ev}/catalog`);
  const tables = useLive<Record<string, Table>>(ev && `${ev}/tables`);
  const bars = useLive<Record<string, Bar>>(ev && `${ev}/bars`);
  const waiters = useLive<Record<string, WaiterProfile>>(ev && `${ev}/waiters`);
  const orders = useOpenOrders(eventId);
  const all = [pub, system, catalog, tables, bars, waiters, orders];
  if (all.some(l => l.status === 'error')) return { status: 'error' };
  if (
    pub.status !== 'ready' || system.status !== 'ready' || catalog.status !== 'ready' || tables.status !== 'ready' ||
    bars.status !== 'ready' || waiters.status !== 'ready' || orders.status !== 'ready' || !pub.value || !catalog.value
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
      waiters: waiters.value ?? {},
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
