import { ref, update } from 'firebase/database';
import { useEffect } from 'react';
import { db, app } from '@/data/firebase';

/** Keeps the screen on while `on` (re-acquired whenever the page becomes visible again). */
export function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let alive = true;
    const acquire = async () => {
      if (document.visibilityState !== 'visible' || (lock && !lock.released)) return;
      try {
        lock = await navigator.wakeLock.request('screen');
        if (!alive) void lock.release();
      } catch {
        /* battery saver or not allowed: screen may turn off */
      }
    };
    void acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', acquire);
      void lock?.release();
    };
  }, [on]);
}

export type PushState = 'on' | 'denied' | 'unsupported' | 'off';

const env = import.meta.env;

/** What push can do on this device right now, without asking. */
export function pushState(): PushState {
  if (!env.VITE_FIREBASE_VAPID_KEY || env.VITE_USE_EMULATORS === '1') return 'unsupported';
  if (!('serviceWorker' in navigator) || !('Notification' in window) || !('PushManager' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.permission === 'granted' ? 'on' : 'off';
}

/**
 * Asks for notification permission (must run from a tap) and stores this device's FCM token
 * in the waiter profile, so `notifyWaiters` reaches the phone while it is locked.
 */
export async function enablePush(eventId: string, uid: string): Promise<PushState> {
  if (pushState() === 'unsupported') return 'unsupported';
  const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';
  try {
    const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
    if (!(await isSupported())) return 'unsupported';
    const base = env.BASE_URL;
    const registration = await navigator.serviceWorker.register(`${base}push-sw.js`, { scope: base });
    const token = await getToken(getMessaging(app), { vapidKey: env.VITE_FIREBASE_VAPID_KEY, serviceWorkerRegistration: registration });
    if (!token) return 'off';
    await update(ref(db, `events/${eventId}/waiters/${uid}`), { fcmToken: token });
    return 'on';
  } catch {
    return 'unsupported';
  }
}
