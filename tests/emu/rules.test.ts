import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { defaultCatalog } from '../../shared/catalog-seed';
import { rulesEnv } from './helpers';

let env: RulesTestEnvironment;
const E = 'evA';
const later = Date.now() + 3600_000;

const waiter = (uid = 'w1', overrides: Record<string, unknown> = {}) =>
  env.authenticatedContext(uid, { role: 'waiter', eventId: E, gen: 0, until: later, ...overrides }).database();
const bar = (uid = 'b1', overrides: Record<string, unknown> = {}) =>
  env.authenticatedContext(uid, { role: 'bar', eventId: E, gen: 0, until: later, ...overrides }).database();
const feed = (db: ReturnType<typeof waiter>, child: string, value: string) =>
  db.ref(`events/${E}/orders`).orderByChild(child).equalTo(value).get();
const keys = async (p: Promise<{ val(): unknown }>) => Object.keys(((await p).val() as object) ?? {}).sort();
const admin = () => env.authenticatedContext('admin-1', { role: 'admin', until: later }).database();
const guest = () => env.unauthenticatedContext().database();

beforeAll(async () => {
  env = await rulesEnv();
});
afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async ctx => {
    await ctx.database().ref().set({
      guestCodes: { ABCDEFGHJK: { eventId: E, tableId: 't1' } },
      events: {
        [E]: {
          public: { name: 'Test', status: 'live', mode: 'tables', startsAt: 1, endsAt: later, language: 'koelsch', archiveMinutes: 10, accent: { primary: '#009640', secondary: '#FFCC00' } },
          catalog: defaultCatalog(),
          gen: { waiter: 0, bar: 0 },
          bars: { main: { name: 'Theke', tableIds: [] } },
          waiters: { w1: { name: 'Anna', tableIds: ['t1'], lastSeen: 1 } },
          system: { shutdown: false, ordersPaused: false },
          tables: { t1: { label: '12', guestCode: 'ABCDEFGHJK', sort: 1 } },
          orders: {
            o1: { type: 'order', totalCents: 300, open: true, wFeed: 'all', bFeed: 'bar' },
            call1: { type: 'call', totalCents: 0, open: true, wFeed: 'all' },
            tabA: { type: 'tab', waiterUid: 'w1', totalCents: 600, open: true, wFeed: 'w:w1', sendToBar: false },
            tabB: { type: 'tab', waiterUid: 'w2', totalCents: 600, open: true, wFeed: 'w:w2', bFeed: 'bar', sendToBar: true },
            done: { type: 'order', totalCents: 300, open: false },
          },
          tableStatus: { ABCDEFGHJK: { o1: { status: 'new' } } },
          stats: { totalCents: 300 },
        },
      },
      secrets: { adminPin: { salt: 'x', hash: 'y' }, eventStaffToken: { [E]: { waiter: 'WTOKEN', bar: 'BTOKEN' } } },
      eventIndex: { [E]: { name: 'Test', status: 'live', mode: 'tables', startsAt: 1, endsAt: later, createdAt: 1 } },
    });
  });
});

describe('guest (no login)', () => {
  it('can read what the order page needs', async () => {
    const db = guest();
    await assertSucceeds(db.ref('guestCodes/ABCDEFGHJK').get());
    await assertSucceeds(db.ref(`events/${E}/public`).get());
    await assertSucceeds(db.ref(`events/${E}/catalog`).get());
    await assertSucceeds(db.ref(`events/${E}/system`).get());
    await assertSucceeds(db.ref(`events/${E}/tables/t1/label`).get());
    await assertSucceeds(db.ref(`events/${E}/tableStatus/ABCDEFGHJK`).get());
  });
  it('cannot list codes, events, orders, tables, stats or secrets', async () => {
    const db = guest();
    await assertFails(db.ref('guestCodes').get());
    await assertFails(db.ref('events').get());
    await assertFails(db.ref(`events/${E}/orders`).get());
    await assertFails(db.ref(`events/${E}/tables`).get());
    await assertFails(db.ref(`events/${E}/tables/t1/guestCode`).get());
    await assertFails(db.ref(`events/${E}/stats`).get());
    await assertFails(db.ref('secrets/adminPin').get());
    await assertFails(db.ref(`secrets/eventStaffToken/${E}`).get());
    await assertFails(db.ref('eventIndex').get());
  });
  it('cannot write anything — no fake orders, prices, deletes or shutdown', async () => {
    const db = guest();
    await assertFails(db.ref(`events/${E}/orders/x`).set({ type: 'order', totalCents: 0 }));
    await assertFails(db.ref(`events/${E}/orders/o1`).remove());
    await assertFails(db.ref(`events/${E}/catalog/products/koelsch/priceCents`).set(1));
    await assertFails(db.ref(`events/${E}/catalog/products/koelsch/soldOut`).set(true));
    await assertFails(db.ref(`events/${E}/system/shutdown`).set(true));
    await assertFails(db.ref(`events/${E}/tableStatus/ABCDEFGHJK/o1`).remove());
    await assertFails(db.ref('guestCodes/ZZZZZZZZZZ').set({ eventId: E, tableId: 't1' }));
    await assertFails(db.ref().set(null));
  });
});

describe('waiter link', () => {
  it('reads the shared feed and its own tabs only', async () => {
    const db = waiter('w1');
    expect(await keys(feed(db, 'wFeed', 'all'))).toEqual(['call1', 'o1']);
    expect(await keys(feed(db, 'wFeed', 'w:w1'))).toEqual(['tabA']);
    await assertSucceeds(db.ref(`events/${E}/tables`).get());
    await assertSucceeds(db.ref(`events/${E}/waiters`).get());
    await assertSucceeds(db.ref(`events/${E}/bars`).get());
  });
  it('cannot read a colleague tab, the bar feed, closed orders or the whole list', async () => {
    const db = waiter('w1');
    await assertFails(feed(db, 'wFeed', 'w:w2'));
    await assertFails(feed(db, 'wFeed', 'w:'));
    await assertFails(feed(db, 'bFeed', 'bar'));
    await assertFails(feed(db, 'open', 'true'));
    await assertFails(db.ref(`events/${E}/orders`).get());
    await assertFails(db.ref(`events/${E}/orders`).orderByChild('wFeed').get());
    await assertFails(db.ref(`events/${E}/orders`).orderByChild('wFeed').startAt('w:').get());
    await assertFails(db.ref(`events/${E}/orders/tabB`).get());
    await assertFails(db.ref(`events/${E}/orders/o1`).get());
  });
  it('cannot change prices, products, orders, stats or system state, and sees no secrets', async () => {
    const db = waiter();
    await assertFails(db.ref(`events/${E}/catalog/products/koelsch/priceCents`).set(1));
    await assertFails(db.ref(`events/${E}/catalog/products/neu`).set({ name: 'X' }));
    await assertFails(db.ref(`events/${E}/catalog/products/neu/soldOut`).set(true));
    await assertFails(db.ref(`events/${E}/orders/o1/totalCents`).set(0));
    await assertFails(db.ref(`events/${E}/stats`).get());
    await assertFails(db.ref(`events/${E}/system/ordersPaused`).set(true));
    await assertFails(db.ref(`events/${E}/public/name`).set('Gekapert'));
    await assertFails(db.ref(`secrets/eventStaffToken/${E}`).get());
    await assertFails(db.ref(`secrets/eventStaffToken/${E}/waiter`).get());
  });
  it('marks products sold out and writes only its own valid profile', async () => {
    const db = waiter('w1');
    await assertSucceeds(db.ref(`events/${E}/catalog/products/koelsch/soldOut`).set(true));
    await assertSucceeds(db.ref(`events/${E}/waiters/w1`).set({ name: 'Anna', tableIds: ['t1'], lastSeen: Date.now() }));
    await assertFails(db.ref(`events/${E}/waiters/w2`).set({ name: 'Fake', lastSeen: Date.now() }));
    await assertFails(db.ref(`events/${E}/waiters/w1`).set({ name: 'Anna', lastSeen: Date.now(), role: 'admin' }));
    await assertFails(db.ref(`events/${E}/waiters/w1/name`).set(''));
  });
});

describe('bar link', () => {
  it('reads only the bar feed, which includes tabs sent to the bar but no private tabs', async () => {
    const db = bar();
    expect(await keys(feed(db, 'bFeed', 'bar'))).toEqual(['o1', 'tabB']);
    await assertSucceeds(db.ref(`events/${E}/tables`).get());
    await assertSucceeds(db.ref(`events/${E}/bars`).get());
  });
  it('cannot read waiter feeds, private tabs, waiter profiles or the whole list', async () => {
    const db = bar();
    await assertFails(feed(db, 'wFeed', 'all'));
    await assertFails(feed(db, 'wFeed', 'w:w1'));
    await assertFails(feed(db, 'bFeed', 'x'));
    await assertFails(db.ref(`events/${E}/orders`).get());
    await assertFails(db.ref(`events/${E}/orders/tabA`).get());
    await assertFails(db.ref(`events/${E}/waiters`).get());
    await assertFails(db.ref(`events/${E}/stats`).get());
  });
  it('may show the waiter link but never the bar link or anything else secret', async () => {
    const db = bar();
    await assertSucceeds(db.ref(`secrets/eventStaffToken/${E}/waiter`).get());
    await assertFails(db.ref(`secrets/eventStaffToken/${E}/bar`).get());
    await assertFails(db.ref(`secrets/eventStaffToken/${E}`).get());
    await assertFails(db.ref('secrets/adminPin').get());
  });
  it('marks sold out but has no waiter profile and cannot change the catalog or system', async () => {
    const db = bar();
    await assertSucceeds(db.ref(`events/${E}/catalog/products/koelsch/soldOut`).set(true));
    await assertFails(db.ref(`events/${E}/catalog/products/koelsch/priceCents`).set(1));
    await assertFails(db.ref(`events/${E}/waiters/b1`).set({ name: 'Theke', lastSeen: Date.now() }));
    await assertFails(db.ref(`events/${E}/system/shutdown`).set(true));
  });
});

describe('locked out', () => {
  it('other events, expired sessions and rotated links read nothing', async () => {
    await assertFails(feed(waiter('w1', { eventId: 'evB' }), 'wFeed', 'all'));
    await assertFails(feed(bar('b1', { eventId: 'evB' }), 'bFeed', 'bar'));
    await assertFails(feed(waiter('w1', { until: Date.now() - 1 }), 'wFeed', 'all'));
    await assertFails(feed(bar('b1', { until: Date.now() - 1 }), 'bFeed', 'bar'));
    await assertFails(feed(waiter('w1', { gen: 1 }), 'wFeed', 'all'));
  });
  it('rotating the waiter link does not lock out the bar and vice versa', async () => {
    await env.withSecurityRulesDisabled(ctx => ctx.database().ref(`events/${E}/gen/waiter`).set(1));
    await assertFails(feed(waiter('w1'), 'wFeed', 'all'));
    await assertSucceeds(feed(bar(), 'bFeed', 'bar'));
    await assertSucceeds(feed(waiter('w1', { gen: 1 }), 'wFeed', 'all'));
    await env.withSecurityRulesDisabled(ctx => ctx.database().ref(`events/${E}/gen/bar`).set(1));
    await assertFails(feed(bar(), 'bFeed', 'bar'));
  });
  it('a bar session cannot read waiter feeds and a waiter session cannot read the bar feed', async () => {
    await assertFails(feed(bar(), 'wFeed', 'all'));
    await assertFails(feed(waiter(), 'bFeed', 'bar'));
  });
});

describe('admin (PIN session)', () => {
  it('edits catalog and system with validation', async () => {
    const db = admin();
    await assertSucceeds(db.ref(`events/${E}/catalog/products/koelsch/priceCents`).set(350));
    await assertFails(db.ref(`events/${E}/catalog/products/koelsch/priceCents`).set(3.5));
    await assertFails(db.ref(`events/${E}/catalog/products/koelsch/priceCents`).set(-1));
    await assertFails(db.ref(`events/${E}/catalog/products/koelsch/categoryId`).set('gibtsnicht'));
    await assertSucceeds(db.ref(`events/${E}/system/shutdown`).set(true));
    await assertSucceeds(db.ref(`events/${E}/stats`).get());
    await assertSucceeds(db.ref(`secrets/eventStaffToken/${E}`).get());
    await assertSucceeds(db.ref('eventIndex').get());
    await assertSucceeds(db.ref(`events/${E}/orders`).get());
  });
  it('changes event settings only through functions, but may reassign waiter tables', async () => {
    const db = admin();
    await assertFails(db.ref(`events/${E}/public/name`).set('Direkt'));
    await assertFails(db.ref(`events/${E}/public/status`).set('closed'));
    await assertSucceeds(db.ref(`events/${E}/waiters/w1/tableIds`).set(['t1', 't2']));
    await assertFails(db.ref(`events/${E}/waiters/neu`).set({ name: 'Neu', lastSeen: Date.now() }));
    await assertSucceeds(db.ref(`events/${E}/waiters/w1`).remove());
    await assertFails(db.ref('eventIndex/x').set({ name: 'x' }));
  });
  it('still cannot touch orders or the PIN hash directly', async () => {
    const db = admin();
    await assertFails(db.ref(`events/${E}/orders/o1`).remove());
    await assertFails(db.ref('secrets/adminPin').get());
    await assertFails(db.ref('secrets/adminPin').set({ salt: 'a', hash: 'b' }));
  });
  it('expired admin sessions are rejected', async () => {
    const db = env.authenticatedContext('admin-1', { role: 'admin', until: Date.now() - 1 }).database();
    await assertFails(db.ref(`events/${E}/system/shutdown`).set(true));
  });
});

describe('guest feedback (PräsenzWert popup)', () => {
  it('can be created once, never read, changed or deleted by guests', async () => {
    const db = guest();
    const entry = { rating: 5, message: 'Super', eventId: E, createdAt: Date.now() };
    await assertSucceeds(db.ref('feedback/f1').set(entry));
    await assertFails(db.ref('feedback/f1').set({ ...entry, rating: 1 }));
    await assertFails(db.ref('feedback/f1').remove());
    await assertFails(db.ref('feedback').get());
    await assertFails(db.ref('feedback/f2').set({ ...entry, rating: 9 }));
    await assertFails(db.ref('feedback/f3').set({ ...entry, extra: 'x' }));
    await assertFails(db.ref('feedback/f4').set({ ...entry, message: 'x'.repeat(601) }));
    await assertSucceeds(admin().ref('feedback').get());
  });
});
