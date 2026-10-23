import { equalTo, onValue, orderByChild, query, ref } from 'firebase/database';
import { useEffect, useState } from 'react';
import type { Order } from '@shared/types';
import { db } from './firebase';

/**
 * Open orders this session may read. The database only answers exact feed queries:
 * waiters get the shared feed plus their own private tabs, the bar gets the bar feed.
 * (Served and cancelled orders leave every feed, so they never reach the phone.)
 */
export function useOpenOrders(eventId: string | null, feeds: { child: 'wFeed' | 'bFeed' | 'open'; value: string | boolean }[]): Live<Record<string, Order>> {
  const [state, setState] = useState<Live<Record<string, Order>>>({ status: 'loading' });
  const key = feeds.map(f => `${f.child}=${String(f.value)}`).join('|');
  useEffect(() => {
    if (!eventId) return;
    setState({ status: 'loading' });
    const parts: (Record<string, Order> | null | undefined)[] = feeds.map(() => undefined);
    const emit = () => {
      if (parts.some(p => p === undefined)) return;
      setState({ status: 'ready', value: Object.assign({}, ...parts) as Record<string, Order> });
    };
    const offs = feeds.map((f, i) =>
      onValue(
        query(ref(db, `events/${eventId}/orders`), orderByChild(f.child), equalTo(f.value)),
        snap => {
          parts[i] = snap.val() as Record<string, Order> | null;
          emit();
        },
        error => setState({ status: 'error', error }),
      ),
    );
    return () => offs.forEach(off => off());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for `feeds`
  }, [eventId, key]);
  return state;
}

export type Live<T> =
  | { status: 'loading' }
  | { status: 'ready'; value: T | null }
  | { status: 'error'; error: Error };

/** Subscribes to one database path. Pass null to stay idle. */
export function useLive<T>(path: string | null): Live<T> {
  const [state, setState] = useState<Live<T>>({ status: 'loading' });
  useEffect(() => {
    if (!path) return;
    setState({ status: 'loading' });
    return onValue(
      ref(db, path),
      snap => setState({ status: 'ready', value: snap.val() as T | null }),
      error => setState({ status: 'error', error }),
    );
  }, [path]);
  return state;
}

/** Current time, re-rendered every `ms` – drives waiting timers. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
