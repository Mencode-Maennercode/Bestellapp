import type { EventPublic } from './types';

/** Orders and staff sessions are accepted from 1 h before start until 1 h after end. */
export const EVENT_GRACE_MS = 60 * 60 * 1000;

export type EventGate = 'open' | 'notStarted' | 'ended' | 'notLive';

export function eventGate(ev: Pick<EventPublic, 'status' | 'startsAt' | 'endsAt'>, now: number): EventGate {
  if (ev.status !== 'live') return ev.status === 'closed' ? 'ended' : 'notLive';
  if (now < ev.startsAt - EVENT_GRACE_MS) return 'notStarted';
  if (now > ev.endsAt + EVENT_GRACE_MS) return 'ended';
  return 'open';
}

/** Moment until which a staff session for this event stays valid. */
export function sessionUntil(ev: Pick<EventPublic, 'endsAt'>): number {
  return ev.endsAt + EVENT_GRACE_MS;
}
