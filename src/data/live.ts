import { equalTo, onValue, orderByChild, query, ref } from 'firebase/database';
import { useEffect, useState } from 'react';
import type { Order } from '@shared/types';
import { db } from './firebase';

/** Open orders of one event (served and cancelled ones stay out of the download). */
export function useOpenOrders(eventId: string | null): Live<Record<string, Order>> {
  const [state, setState] = useState<Live<Record<string, Order>>>({ status: 'loading' });
  useEffect(() => {
    if (!eventId) return;
    setState({ status: 'loading' });
    return onValue(
      query(ref(db, `events/${eventId}/orders`), orderByChild('open'), equalTo(true)),
      snap => setState({ status: 'ready', value: snap.val() as Record<string, Order> | null }),
      error => setState({ status: 'error', error }),
    );
  }, [eventId]);
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
