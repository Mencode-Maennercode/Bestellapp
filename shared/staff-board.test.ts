import { describe, expect, it } from 'vitest';
import { defaultCatalog } from './catalog-seed';
import { ALL_BARS, alarmCandidates, barFor, barLists, tally, waiterLists } from './staff-board';
import type { Bar, Order, WaiterProfile } from './types';

const now = 1_800_000_000_000;
const min = 60_000;

function order(p: Partial<Order>): Order {
  return {
    type: 'order', source: 'guest', sendToBar: true, items: [{ productId: 'koelsch', name: 'Kölsch', priceCents: 300, qty: 1 }],
    totalCents: 300, createdAt: now - min, status: 'new', counted: false, open: true, ...p,
  };
}

const anna = { uid: 'anna', tableIds: ['t12', 't14'] };
const ben = { uid: 'ben', name: 'Ben' };
const waiters: Record<string, WaiterProfile> = {
  anna: { name: 'Anna', tableIds: ['t12', 't14'], lastSeen: now },
  ben: { name: 'Ben', tableIds: ['t20'], lastSeen: now },
  gone: { name: 'Alt', tableIds: ['t30'], lastSeen: now - 60 * min },
};

describe('waiter lists', () => {
  const orders: Record<string, Order> = {
    old: order({ tableId: 't14', createdAt: now - 9 * min }),
    fresh: order({ tableId: 't12', createdAt: now - min }),
    mineElsewhere: order({ tableId: 't20', claimedBy: { uid: 'anna', name: 'Anna' } }),
    takenByBen: order({ tableId: 't12', claimedBy: ben }),
    bens: order({ tableId: 't20' }),
    uncovered: order({ tableId: 't30' }),
    served: order({ tableId: 't12', open: false, servedAt: now }),
    annaTab: order({ type: 'tab', source: 'waiter', waiterUid: 'anna', claimedBy: { uid: 'anna', name: 'Anna' }, sendToBar: false, note: 'Fenster' }),
    benTab: order({ type: 'tab', source: 'waiter', waiterUid: 'ben', claimedBy: ben, note: 'rote Jacke' }),
  };
  const l = waiterLists(orders, anna, waiters, now);

  it('shows my tables, my claims and my tabs, oldest first', () => {
    expect(l.mine.map(([id]) => id)).toEqual(['old', 'fresh', 'mineElsewhere', 'annaTab'].sort((a, b) => orders[a].createdAt - orders[b].createdAt));
    expect(l.mine[0][0]).toBe('old');
  });

  it('never shows a colleague’s Schnellbon, anywhere', () => {
    const all = [...l.mine, ...l.orphan, ...l.colleagues].map(([id]) => id);
    expect(all).not.toContain('benTab');
    const forBen = waiterLists(orders, { uid: 'ben', tableIds: ['t20'] }, waiters, now);
    expect([...forBen.mine, ...forBen.orphan, ...forBen.colleagues].map(([id]) => id)).not.toContain('annaTab');
  });

  it('puts colleague claims aside and surfaces tables nobody present covers', () => {
    expect(l.colleagues.map(([id]) => id)).toEqual(['takenByBen']);
    expect(l.orphan.map(([id]) => id)).toEqual(['uncovered']);
    expect([...l.mine, ...l.orphan].map(([id]) => id)).not.toContain('bens');
    expect(l.mine.map(([id]) => id)).not.toContain('served');
  });

  it('rings only for unclaimed orders on my tables that I did not place myself', () => {
    const extra = { ...orders, own: order({ tableId: 't12', source: 'waiter', waiterUid: 'anna' }) };
    expect(alarmCandidates(extra, anna).sort()).toEqual(['fresh', 'old']);
  });
});

describe('bar lists', () => {
  const bars: Record<string, Bar> = { main: { name: 'Theke', tableIds: [] }, side: { name: 'Theke 2', tableIds: ['t30'] } };
  const orders: Record<string, Order> = {
    a: order({ tableId: 't12', createdAt: now - 2 * min }),
    b: order({ tableId: 't30', createdAt: now - 5 * min }),
    c: order({ tableId: 't12', readyAt: now }),
    call: order({ type: 'call', tableId: 't12', sendToBar: false, items: [], totalCents: 0 }),
    privateTab: order({ type: 'tab', source: 'waiter', waiterUid: 'anna', sendToBar: false }),
    sharedTab: order({ type: 'tab', source: 'waiter', waiterUid: 'anna', createdAt: now - 3 * min }),
    done: order({ tableId: 't12', open: false, servedAt: now }),
  };

  it('routes each table to exactly one bar; tabs go to the bar for all tables', () => {
    expect(barFor('t30', bars)).toBe('side');
    expect(barFor('t12', bars)).toBe('main');
    expect(barFor(undefined, bars)).toBe('main');
  });

  it('lists only bar work, oldest first, without calls or private tabs', () => {
    const main = barLists(orders, 'main', bars);
    expect(main.todo.map(([id]) => id)).toEqual(['sharedTab', 'a']);
    expect(main.ready.map(([id]) => id)).toEqual(['c']);
    expect(barLists(orders, 'side', bars).todo.map(([id]) => id)).toEqual(['b']);
    expect(barLists(orders, ALL_BARS, bars).todo.map(([id]) => id)).toEqual(['b', 'sharedTab', 'a']);
  });

  it('sums the pick list and keeps empty glasses apart', () => {
    const t = tally(
      [
        ['x', order({ items: [{ productId: 'koelsch', name: 'Kölsch', priceCents: 300, qty: 4 }, { productId: 'cola', name: 'Cola', priceCents: 250, qty: 1 }] })],
        ['y', order({ items: [{ productId: 'koelsch', name: 'Kölsch', priceCents: 300, qty: 8 }, { productId: 'glas-normal', name: 'Bierglas', priceCents: 0, qty: 4 }] })],
      ],
      defaultCatalog(),
    );
    expect(t.drinks.map(l => [l.productId, l.qty])).toEqual([['koelsch', 12], ['cola', 1]]);
    expect(t.glasses.map(l => [l.productId, l.qty])).toEqual([['glas-normal', 4]]);
  });
});
