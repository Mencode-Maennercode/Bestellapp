import type { Order, OrderStatus } from './types';
import { countedWaiterOf } from './stats';

export type OrderAction = 'claim' | 'unclaim' | 'ready' | 'unready' | 'serve' | 'unserve' | 'cancel';

export interface Actor {
  uid: string;
  name: string;
  role: 'staff' | 'admin';
}

export class TransitionError extends Error {
  readonly code: 'notAllowed' | 'claimedByOther' | 'finished';
  constructor(code: 'notAllowed' | 'claimedByOther' | 'finished') {
    super(code);
    this.code = code;
  }
}


export function deriveStatus(o: Pick<Order, 'claimedBy' | 'readyAt' | 'servedAt' | 'cancelledAt'>): OrderStatus {
  if (o.cancelledAt) return 'cancelled';
  if (o.servedAt) return 'served';
  if (o.readyAt) return 'ready';
  if (o.claimedBy) return 'accepted';
  return 'new';
}

/** An order counts as revenue once it left the bar or was served. Calls never count. */
export function isCounted(o: Pick<Order, 'type' | 'readyAt' | 'servedAt' | 'cancelledAt'>): boolean {
  return o.type !== 'call' && !o.cancelledAt && !!(o.readyAt || o.servedAt);
}

export function withDerived<T extends Order>(o: T): T {
  const counted = isCounted(o);
  // Credit a waiter when counting starts and keep that credit stable while counted.
  const countedWaiter = counted ? (o.counted && o.countedWaiter ? o.countedWaiter : countedWaiterOf(o)) : null;
  return { ...o, status: deriveStatus(o), counted, countedWaiter, open: !o.cancelledAt && !o.servedAt };
}

/** Pure state transition. Throws TransitionError when the action is not allowed. */
export function applyAction<T extends Order>(order: T, action: OrderAction, actor: Actor, now: number): T {
  const o: T = { ...order };
  const isAdmin = actor.role === 'admin';
  const claimedByOther = !!o.claimedBy && o.claimedBy.uid !== actor.uid;

  if (o.cancelledAt && action !== 'cancel') throw new TransitionError('finished');

  switch (action) {
    case 'claim':
      if (o.servedAt) throw new TransitionError('finished');
      if (claimedByOther) throw new TransitionError('claimedByOther');
      o.claimedBy = { uid: actor.uid, name: actor.name };
      o.claimedAt = o.claimedAt ?? now;
      break;
    case 'unclaim':
      if (!o.claimedBy || o.servedAt) throw new TransitionError('notAllowed');
      if (claimedByOther && !isAdmin) throw new TransitionError('claimedByOther');
      o.claimedBy = null;
      o.claimedAt = null;
      break;
    case 'ready':
      if (o.type === 'call' || o.servedAt || o.readyAt) throw new TransitionError('notAllowed');
      o.readyAt = now;
      break;
    case 'unready':
      if (!o.readyAt || o.servedAt) throw new TransitionError('notAllowed');
      o.readyAt = null;
      break;
    case 'serve':
      if (o.servedAt) throw new TransitionError('finished');
      if (claimedByOther && !isAdmin) throw new TransitionError('claimedByOther');
      if (!o.claimedBy) {
        o.claimedBy = { uid: actor.uid, name: actor.name };
        o.claimedAt = now;
      }
      o.servedAt = now;
      break;
    case 'unserve':
      if (!o.servedAt) throw new TransitionError('notAllowed');
      if (claimedByOther && !isAdmin) throw new TransitionError('claimedByOther');
      o.servedAt = null;
      break;
    case 'cancel':
      if (o.cancelledAt) throw new TransitionError('finished');
      if (o.servedAt && !isAdmin) throw new TransitionError('notAllowed');
      o.cancelledAt = now;
      break;
  }
  return withDerived(o);
}
