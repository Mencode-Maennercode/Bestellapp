import { getMessaging } from 'firebase-admin/messaging';
import { onValueCreated } from 'firebase-functions/v2/database';
import { logger } from 'firebase-functions/v2';
import type { Order, WaiterProfile } from '../../shared/types';
import { formatEUR } from '../../shared/money';
import { REGION, db, paths, read } from './core';

/**
 * Push to the waiters assigned to the order's table.
 * Tabs (private notes) and orders without table never notify anyone; the creator is never notified.
 */
export const notifyWaiters = onValueCreated(
  { ref: '/events/{eventId}/orders/{orderId}', region: REGION },
  async event => {
    const order = event.data.val() as Order;
    const { eventId, orderId } = event.params;
    if (order.type === 'tab' || !order.tableId) return;

    const waiters = (await read<Record<string, WaiterProfile>>(paths.waiters(eventId))) ?? {};
    const targets = Object.entries(waiters).filter(
      ([uid, w]) => uid !== order.waiterUid && w.fcmToken && (w.tableIds ?? []).includes(order.tableId!),
    );
    if (!targets.length) return;

    const items = (order.items ?? []).reduce((n, i) => n + i.qty, 0); // calls are stored without items
    const title = order.type === 'call' ? `Tisch ${order.tableLabel} ruft` : `Neue Bestellung · Tisch ${order.tableLabel}`;
    const body = order.type === 'call' ? 'Bitte zum Tisch kommen' : `${items} Artikel · ${formatEUR(order.totalCents)}`;

    const res = await getMessaging().sendEachForMulticast({
      tokens: targets.map(([, w]) => w.fcmToken!),
      notification: { title, body },
      data: { eventId, orderId, type: order.type },
      android: { priority: 'high', notification: { channelId: 'orders', priority: 'max', sound: 'default' } },
      webpush: {
        headers: { Urgency: 'high' },
        notification: { requireInteraction: true, renotify: true, tag: `order-${orderId}` },
      },
      apns: { payload: { aps: { sound: 'default' } } },
    });

    // Drop tokens that FCM reports as dead so we stop sending to them.
    const dead: Record<string, null> = {};
    res.responses.forEach((r, i) => {
      const code = r.error?.code ?? '';
      if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token')) {
        dead[`${paths.waiters(eventId)}/${targets[i][0]}/fcmToken`] = null;
      }
    });
    if (Object.keys(dead).length) await db.ref().update(dead);
    logger.info('push', { orderId, sent: res.successCount, failed: res.failureCount });
  },
);
