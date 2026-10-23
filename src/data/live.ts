import { onValue, ref } from 'firebase/database';
import { useEffect, useState } from 'react';
import { db } from './firebase';

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
