import { describe, expect, it } from 'vitest';
import { formatEUR, parseEUR, shareCents } from './money';
import { priceOrder, OrderError, summarize } from './pricing';
import { applyAction, withDerived, TransitionError, type Actor } from './order-lifecycle';
import { statsDelta, NO_TABLE } from './stats';
import { eventGate, EVENT_GRACE_MS } from './event-window';
import { urgencyFor, formatAge } from './urgency';
import { randomCode, CODE_PATTERN } from './codes';
import { defaultCatalog, glassProductId } from './catalog-seed';
import type { Order } from './types';

const catalog = defaultCatalog();
const anna: Actor = { uid: 'u-anna', name: 'Anna', role: 'waiter' };
const ben: Actor = { uid: 'u-ben', name: 'Ben', role: 'waiter' };
const theke: Actor = { uid: 'u-theke', name: 'Theke', role: 'bar' };
const admin: Actor = { uid: 'u-admin', name: 'Admin', role: 'admin' };

function newOrder(partial: Partial<Order> = {}): Order {
  const { items, totalCents } = priceOrder([{ productId: 'koelsch', qty: 3 }, { productId: 'cola', qty: 1 }], catalog);
  return withDerived({
    type: 'order', source: 'guest', tableId: 't12', tableLabel: '12', sendToBar: true,
    items, totalCents, createdAt: 1, status: 'new', counted: false, open: true, ...partial,
  });
}

function errorCode(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return (e as OrderError).code;
  }
  return undefined;
}

describe('money', () => {
  it('formats cents in German', () => {
    expect(formatEUR(250)).toBe('2,50 €');
    expect(formatEUR(6000)).toBe('60,00 €');
  });
  it('parses user input without float errors', () => {
    expect(parseEUR('2,50')).toBe(250);
    expect(parseEUR('0.10')).toBe(10);
    expect(parseEUR('19,9 €')).toBe(1990);
    expect(parseEUR('3')).toBe(300);
    expect(parseEUR('-1')).toBeNull();
    expect(parseEUR('1,234')).toBeNull();
    expect(parseEUR('abc')).toBeNull();
  });
  it('computes the 1.5 % share rounded half up', () => {
    expect(shareCents(10000, 15)).toBe(150);
    expect(shareCents(33, 15)).toBe(0); // 0.495 ct
    expect(shareCents(34, 15)).toBe(1); // 0.51 ct
  });
});

describe('pricing', () => {
  it('uses catalog prices and merges duplicate lines', () => {
    const r = priceOrder(
      [{ productId: 'koelsch', qty: 2 }, { productId: 'koelsch', qty: 1 }, { productId: 'glas-secco', qty: 1 }],
      catalog,
    );
    expect(r.items).toEqual([
      { productId: 'koelsch', name: 'Kölsch', priceCents: 300, qty: 3 },
      { productId: 'glas-secco', name: 'Glas Secco', priceCents: 600, qty: 1 },
    ]);
    expect(r.totalCents).toBe(1500);
    expect(summarize(r.items)).toBe('3× Kölsch, 1× Glas Secco');
  });
  it('adds 0.10-style prices exactly', () => {
    const c = defaultCatalog();
    c.products.cola.priceCents = 10;
    c.products.sprite.priceCents = 20;
    expect(priceOrder([{ productId: 'cola', qty: 1 }, { productId: 'sprite', qty: 1 }], c).totalCents).toBe(30);
  });
  it('rejects unknown, inactive, sold-out, empty and bad quantities', () => {
    const c = defaultCatalog();
    c.products.cola.soldOut = true;
    c.products.fanta.active = false;
    expect(errorCode(() => priceOrder([], c))).toBe('empty');
    expect(errorCode(() => priceOrder([{ productId: 'nope', qty: 1 }], c))).toBe('unknown');
    expect(errorCode(() => priceOrder([{ productId: 'fanta', qty: 1 }], c))).toBe('unknown');
    expect(errorCode(() => priceOrder([{ productId: 'cola', qty: 1 }], c))).toBe('soldOut');
    expect(errorCode(() => priceOrder([{ productId: 'pils', qty: 0 }], c))).toBe('badQty');
    expect(errorCode(() => priceOrder([{ productId: 'pils', qty: 51 }], c))).toBe('badQty');
    expect(errorCode(() => priceOrder([{ productId: 'pils', qty: 30 }, { productId: 'pils', qty: 30 }], c))).toBe('badQty');
  });
  it('finds empty glass products', () => {
    expect(glassProductId(catalog, 'wine')).toBe('glas-wein-leer');
  });
});

describe('order lifecycle', () => {
  it('derives status through the normal flow', () => {
    let o = newOrder();
    expect(o.status).toBe('new');
    o = applyAction(o, 'claim', anna, 10);
    expect(o.status).toBe('accepted');
    o = applyAction(o, 'ready', anna, 20);
    expect([o.status, o.counted, o.open]).toEqual(['ready', true, true]);
    o = applyAction(o, 'serve', anna, 30);
    expect([o.status, o.counted, o.open]).toEqual(['served', true, false]);
  });
  it('handles a waiter call read back from the database without items', () => {
    const stored = { ...newOrder({ type: 'call', sendToBar: false, totalCents: 0 }) } as Partial<Order>;
    delete stored.items; // the database drops empty lists
    const o = applyAction(stored as Order, 'claim', anna, 10);
    expect([o.status, o.items, o.bFeed]).toEqual(['accepted', [], null]);
  });
  it('prevents a second waiter from taking a claimed order', () => {
    const o = applyAction(newOrder(), 'claim', anna, 10);
    expect(() => applyAction(o, 'claim', ben, 11)).toThrow(TransitionError);
    expect(() => applyAction(o, 'serve', ben, 11)).toThrow(TransitionError);
    expect(applyAction(o, 'serve', admin, 11).status).toBe('served');
  });
  it('serving an unclaimed order credits the server', () => {
    const o = applyAction(newOrder(), 'serve', ben, 5);
    expect(o.claimedBy?.name).toBe('Ben');
    expect(o.countedWaiter).toBe('u-ben');
  });
  it('waiter calls never count as revenue and cannot be "ready"', () => {
    const call = withDerived({ ...newOrder(), type: 'call' as const, items: [], totalCents: 0 });
    expect(() => applyAction(call, 'ready', anna, 1)).toThrow(TransitionError);
    expect(applyAction(call, 'serve', anna, 1).counted).toBe(false);
  });
  it('cancel removes from boards and stats; staff cannot cancel served orders', () => {
    const served = applyAction(newOrder(), 'serve', anna, 1);
    expect(() => applyAction(served, 'cancel', anna, 2)).toThrow(TransitionError);
    const c = applyAction(served, 'cancel', admin, 2);
    expect([c.status, c.counted, c.open]).toEqual(['cancelled', false, false]);
  });
});

describe('who may read and act on an order', () => {
  const tab = (sendToBar: boolean) =>
    withDerived({ ...newOrder(), type: 'tab' as const, tableId: undefined, waiterUid: 'u-anna', waiterName: 'Anna', sendToBar });

  it('puts table orders in the shared feeds and closes both feeds when done', () => {
    const o = newOrder();
    expect([o.wFeed, o.bFeed]).toEqual(['all', 'bar']);
    const done = applyAction(o, 'serve', anna, 1);
    expect([done.wFeed, done.bFeed]).toEqual([null, null]);
    const call = withDerived({ ...newOrder(), type: 'call' as const, sendToBar: false, items: [], totalCents: 0 });
    expect([call.wFeed, call.bFeed]).toEqual(['all', null]);
  });
  it('keeps tabs private: only the owner feed, and the bar feed only when sent to the bar', () => {
    expect([tab(false).wFeed, tab(false).bFeed]).toEqual(['w:u-anna', null]);
    expect([tab(true).wFeed, tab(true).bFeed]).toEqual(['w:u-anna', 'bar']);
  });
  it('another waiter cannot touch a tab, not even cancel it', () => {
    for (const action of ['claim', 'serve', 'cancel'] as const) expect(() => applyAction(tab(true), action, ben, 1)).toThrow(TransitionError);
    expect(applyAction(tab(true), 'cancel', anna, 1).status).toBe('cancelled');
  });
  it('the bar may only mark bar orders ready (and take that back)', () => {
    const ready = applyAction(newOrder(), 'ready', theke, 1);
    expect(ready.status).toBe('ready');
    expect(applyAction(ready, 'unready', theke, 2).status).toBe('new');
    for (const action of ['claim', 'serve', 'cancel'] as const) expect(() => applyAction(newOrder(), action, theke, 1)).toThrow(TransitionError);
    expect(() => applyAction(tab(false), 'ready', theke, 1)).toThrow(TransitionError);
    expect(applyAction(tab(true), 'ready', theke, 1).status).toBe('ready');
  });
});

describe('stats', () => {
  it('counts once and reverses exactly on undo', () => {
    const o0 = applyAction(newOrder(), 'claim', anna, 1);
    const o1 = applyAction(o0, 'ready', anna, 2);
    const plus = statsDelta(o0, o1);
    expect(plus.totalOrders).toBe(1);
    expect(plus.totalCents).toBe(1150);
    expect(plus['byProduct/koelsch/qty']).toBe(3);
    expect(plus['byProduct/koelsch/cents']).toBe(900);
    expect(plus['byWaiter/u-anna/cents']).toBe(1150);

    // Serving after ready does not count again.
    const o2 = applyAction(o1, 'serve', anna, 3);
    expect(statsDelta(o1, o2)).toEqual({});

    // Undo serve + undo ready reverses the credited waiter even after a claim change.
    const o3 = applyAction(applyAction(o2, 'unserve', anna, 4), 'unclaim', anna, 5);
    const o4 = applyAction(o3, 'claim', ben, 6);
    const o5 = applyAction(o4, 'unready', ben, 7);
    const minus = statsDelta(o4, o5);
    expect(minus.totalCents).toBe(-1150);
    expect(minus['byWaiter/u-anna/cents']).toBe(-1150);
    expect(minus['byWaiter/u-ben/cents']).toBeUndefined();
  });
  it('books tabs without table under a dedicated key', () => {
    const tab = withDerived({ ...newOrder(), type: 'tab' as const, tableId: undefined, waiterUid: 'u-anna', waiterName: 'Anna' });
    const d = statsDelta(tab, applyAction(tab, 'serve', anna, 1));
    expect(d[`byTable/${NO_TABLE}/orders`]).toBe(1);
  });
});

describe('event window', () => {
  const ev = { status: 'live' as const, startsAt: 1_000_000_000_000, endsAt: 1_000_000_000_000 + 8 * 3600_000 };
  it('is open only while live and within the grace window', () => {
    expect(eventGate(ev, ev.startsAt)).toBe('open');
    expect(eventGate(ev, ev.startsAt - EVENT_GRACE_MS - 1)).toBe('notStarted');
    expect(eventGate(ev, ev.endsAt + EVENT_GRACE_MS + 1)).toBe('ended');
    expect(eventGate({ ...ev, status: 'closed' }, ev.startsAt)).toBe('ended');
    expect(eventGate({ ...ev, status: 'draft' }, ev.startsAt)).toBe('notLive');
  });
});

describe('urgency & codes', () => {
  it('escalates with waiting time', () => {
    expect(urgencyFor(0, 2 * 60_000)).toBe('calm');
    expect(urgencyFor(0, 3 * 60_000)).toBe('warn');
    expect(urgencyFor(0, 6 * 60_000)).toBe('late');
    expect(formatAge(0, 185_000)).toBe('3:05');
  });
  it('creates codes from the unambiguous alphabet', () => {
    const rand = (n: number) => crypto.getRandomValues(new Uint8Array(n));
    for (let i = 0; i < 200; i++) expect(randomCode(10, rand)).toMatch(CODE_PATTERN);
  });
});
