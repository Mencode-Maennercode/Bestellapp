import type { Order } from './types';

/** Key for orders without a table (tabs). */
export const NO_TABLE = '_ohneTisch';
export const UNKNOWN_WAITER = '_unbekannt';

/** The waiter credited with an order's revenue. */
export function countedWaiterOf(o: Pick<Order, 'claimedBy' | 'waiterUid'>): string {
  return o.claimedBy?.uid ?? o.waiterUid ?? UNKNOWN_WAITER;
}

/**
 * Relative stats changes for an order whose `counted` flag switched.
 * Returns stats sub-paths mapped to increments (or names), {} when nothing changed.
 * Keys use productId/tableId/uid, never display names, so renames cannot break statistics.
 */
export function statsDelta(
  before: Pick<Order, 'counted' | 'countedWaiter'> | null,
  after: Order,
): Record<string, number | string> {
  const was = !!before?.counted;
  if (was === after.counted) return {};
  const sign = after.counted ? 1 : -1;
  const table = after.tableId ?? NO_TABLE;
  // Reverse exactly the waiter that was credited, even if the claim changed in between.
  const waiter = (after.counted ? after.countedWaiter : before?.countedWaiter) ?? UNKNOWN_WAITER;
  const d: Record<string, number | string> = {
    totalOrders: sign,
    totalCents: sign * after.totalCents,
    [`byTable/${table}/orders`]: sign,
    [`byTable/${table}/cents`]: sign * after.totalCents,
    [`byWaiter/${waiter}/orders`]: sign,
    [`byWaiter/${waiter}/cents`]: sign * after.totalCents,
  };
  const waiterName = after.claimedBy?.name ?? after.waiterName;
  if (after.counted && waiterName) d[`byWaiter/${waiter}/name`] = waiterName;
  for (const i of after.items) {
    const k = `byProduct/${i.productId}`;
    d[`${k}/qty`] = ((d[`${k}/qty`] as number | undefined) ?? 0) + sign * i.qty;
    d[`${k}/cents`] = ((d[`${k}/cents`] as number | undefined) ?? 0) + sign * i.qty * i.priceCents;
    d[`${k}/name`] = i.name;
  }
  return d;
}
