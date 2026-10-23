import { ServerValue } from 'firebase-admin/database';
import { onCall } from 'firebase-functions/v2/https';
import { eventGate } from '../../shared/event-window';
import { applyAction, TransitionError, withDerived, type Actor } from '../../shared/order-lifecycle';
import { OrderError, priceOrder, summarize } from '../../shared/pricing';
import { guestOrderInput, orderActionInput, waiterOrderInput } from '../../shared/schemas';
import { statsDelta } from '../../shared/stats';
import type { Order, SystemState, Table, TableStatusEntry } from '../../shared/types';
import { REGION, db, fail, loadEvent, parse, paths, read, requireStaff, takeSlot } from './core';

const ORDER_GAP_MS = 10 * 1000;
const CALL_GAP_MS = 5 * 60 * 1000;

/** Server-side order record; guestCode links it to the guest's status view. */
type StoredOrder = Order & { guestCode?: string };

function statusEntry(o: StoredOrder): TableStatusEntry {
  return {
    type: o.type,
    status: o.status,
    summary: summarize(o.items),
    totalCents: o.totalCents,
    waiterName: o.claimedBy?.name ?? null,
    createdAt: o.createdAt,
    doneAt: o.servedAt ?? o.cancelledAt ?? null,
  };
}

function price(lines: { productId: string; qty: number }[], catalog: Parameters<typeof priceOrder>[1]) {
  try {
    return priceOrder(lines, catalog);
  } catch (e) {
    if (e instanceof OrderError) fail('failed-precondition', e.code);
    throw e;
  }
}

function assertOpen(pub: Parameters<typeof eventGate>[0], now: number) {
  const gate = eventGate(pub, now);
  if (gate !== 'open') fail('failed-precondition', gate === 'ended' || gate === 'notLive' ? 'eventEnded' : 'eventNotStarted');
}

async function writeOrder(eventId: string, orderId: string, o: StoredOrder) {
  const update: Record<string, unknown> = { [`${paths.orders(eventId)}/${orderId}`]: o };
  if (o.guestCode) update[`${paths.tableStatus(eventId, o.guestCode)}/${orderId}`] = statusEntry(o);
  await db.ref().update(update);
}

/** Guest order or waiter call from a table QR code. Prices are taken from the catalog only. */
export const createGuestOrder = onCall({ region: REGION }, async req => {
  const input = parse(guestOrderInput, req.data);
  const now = Date.now();
  const link = await read<{ eventId: string; tableId: string }>(paths.guestCode(input.code));
  if (!link) fail('not-found', 'codeInvalid');
  const { eventId, tableId } = link;

  const [{ pub, catalog }, system, table] = await Promise.all([
    loadEvent(eventId),
    read<SystemState>(paths.system(eventId)),
    read<Table>(`${paths.tables(eventId)}/${tableId}`),
  ]);
  if (!table || table.guestCode !== input.code) fail('not-found', 'codeInvalid');
  assertOpen(pub, now);
  if (system?.shutdown) fail('failed-precondition', 'shutdown');
  if (input.type === 'order' && system?.ordersPaused) fail('failed-precondition', 'ordersPaused');

  // A retried request returns the order it already created.
  const existing = await read<StoredOrder>(`${paths.orders(eventId)}/${input.requestId}`);
  if (existing) {
    if (existing.guestCode === input.code) return { orderId: input.requestId };
    fail('aborted', 'duplicate');
  }

  // Price first: a rejected cart must not start the cooldown.
  const { items, totalCents } = input.type === 'call'
    ? { items: [], totalCents: 0 }
    : price(input.lines ?? [], catalog);

  const limits = db.ref(paths.limits(eventId, tableId));
  const ok = input.type === 'call'
    ? await takeSlot(limits, 'lastCallAt', CALL_GAP_MS, now)
    : await takeSlot(limits, 'lastOrderAt', ORDER_GAP_MS, now);
  if (!ok) fail('resource-exhausted', 'cooldown');

  const order = withDerived<StoredOrder>({
    type: input.type,
    source: 'guest',
    tableId,
    tableLabel: table.label,
    guestCode: input.code,
    sendToBar: input.type === 'order',
    items,
    totalCents,
    createdAt: now,
    status: 'new',
    counted: false,
    open: true,
  });
  await writeOrder(eventId, input.requestId, order);
  return { orderId: input.requestId };
});

/** Waiter order for a table, or a private tab without table. */
export const createWaiterOrder = onCall({ region: REGION }, async req => {
  const input = parse(waiterOrderInput, req.data);
  const { uid } = await requireStaff(req, input.eventId);
  const now = Date.now();
  const { pub, catalog } = await loadEvent(input.eventId);
  assertOpen(pub, now);

  const name = await read<string>(`${paths.waiters(input.eventId)}/${uid}/name`);
  if (!name) fail('failed-precondition', 'nameMissing');

  let table: Table | null = null;
  if (input.type === 'order') {
    if (!input.tableId) fail('failed-precondition', 'tableMissing');
    table = await read<Table>(`${paths.tables(input.eventId)}/${input.tableId}`);
    if (!table) fail('not-found', 'tableMissing');
  }

  const orderRef = db.ref(`${paths.orders(input.eventId)}/${input.requestId}`);
  if ((await orderRef.get()).exists()) return { orderId: input.requestId };

  const { items, totalCents } = price(input.lines, catalog);
  const order = withDerived<StoredOrder>({
    type: input.type,
    source: 'waiter',
    ...(table ? { tableId: input.tableId, tableLabel: table.label, guestCode: table.guestCode } : {}),
    waiterUid: uid,
    waiterName: name,
    ...(input.type === 'tab' && input.note ? { note: input.note } : {}),
    sendToBar: input.type === 'order' ? true : input.sendToBar,
    items,
    totalCents,
    createdAt: now,
    claimedBy: { uid, name },
    claimedAt: now,
    status: 'new',
    counted: false,
    open: true,
  });
  await writeOrder(input.eventId, input.requestId, order);
  return { orderId: input.requestId };
});

/** Claim / ready / serve / cancel and their undos. Transactional; statistics update exactly once. */
export const orderAction = onCall({ region: REGION }, async req => {
  const { eventId, orderId, action } = parse(orderActionInput, req.data);
  const { uid, role } = await requireStaff(req, eventId);
  const name = (await read<string>(`${paths.waiters(eventId)}/${uid}/name`)) ?? (role === 'admin' ? 'Admin' : 'Theke');
  const actor: Actor = { uid, name, role };
  const now = Date.now();

  const ref = db.ref(`${paths.orders(eventId)}/${orderId}`);
  let before: StoredOrder | null = null;
  let after: StoredOrder | null = null;
  let error: TransitionError | null = null;

  const result = await ref.transaction((cur: StoredOrder | null) => {
    error = null;
    before = null;
    after = null;
    if (cur === null) return null; // first pass may run on an empty cache; the server re-runs with real data
    try {
      before = cur;
      after = applyAction(cur, action, actor, now);
      return after;
    } catch (e) {
      if (e instanceof TransitionError) {
        error = e;
        return; // abort
      }
      throw e;
    }
  });

  if (error) fail('failed-precondition', (error as TransitionError).code);
  if (!result.committed || !result.snapshot.exists() || !after) fail('not-found', 'orderMissing');
  const saved = after as StoredOrder;

  const delta = statsDelta(before, saved);
  const update: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(delta)) {
    update[`${paths.stats(eventId)}/${k}`] = typeof v === 'number' ? ServerValue.increment(v) : v;
  }
  if (saved.guestCode) update[`${paths.tableStatus(eventId, saved.guestCode)}/${orderId}`] = statusEntry(saved);
  if (Object.keys(update).length) await db.ref().update(update);

  return { status: saved.status };
});
