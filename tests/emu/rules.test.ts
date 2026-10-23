import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { defaultCatalog } from '../../shared/catalog-seed';
import { rulesEnv } from './helpers';

let env: RulesTestEnvironment;
const E = 'evA';
const later = Date.now() + 3600_000;

const staff = (uid = 'w1', overrides: Record<string, unknown> = {}) =>
  env.authenticatedContext(uid, { role: 'staff', eventId: E, gen: 0, until: later, ...overrides }).database();
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
          staffGen: 0,
          system: { shutdown: false, ordersPaused: false },
          tables: { t1: { label: '12', guestCode: 'ABCDEFGHJK', sort: 1 } },
          orders: { o1: { type: 'order', totalCents: 300, open: true } },
          tableStatus: { ABCDEFGHJK: { o1: { status: 'new' } } },
          stats: { totalCents: 300 },
        },
      },
      secrets: { adminPin: { salt: 'x', hash: 'y' }, eventStaffToken: { [E]: 'TOKEN' } },
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

describe('staff (waiter / bar link)', () => {
  it('reads orders/tables of its event and marks products sold out', async () => {
    const db = staff();
    await assertSucceeds(db.ref(`events/${E}/orders`).get());
    await assertSucceeds(db.ref(`events/${E}/tables`).get());
    await assertSucceeds(db.ref(`events/${E}/catalog/products/koelsch/soldOut`).set(true));
  });
  it('cannot change prices, products, orders, stats or system state', async () => {
    const db = staff();
    await assertFails(db.ref(`events/${E}/catalog/products/koelsch/priceCents`).set(1));
    await assertFails(db.ref(`events/${E}/catalog/products/neu`).set({ name: 'X' }));
    await assertFails(db.ref(`events/${E}/catalog/products/neu/soldOut`).set(true));
    await assertFails(db.ref(`events/${E}/orders/o1/totalCents`).set(0));
    await assertFails(db.ref(`events/${E}/stats`).get());
    await assertFails(db.ref(`events/${E}/system/ordersPaused`).set(true));
    await assertFails(db.ref(`secrets/eventStaffToken/${E}`).get());
  });
  it('writes only its own waiter profile with valid data', async () => {
    const db = staff('w1');
    await assertSucceeds(db.ref(`events/${E}/waiters/w1`).set({ name: 'Anna', tableIds: ['t1'], lastSeen: Date.now() }));
    await assertFails(db.ref(`events/${E}/waiters/w2`).set({ name: 'Fake', lastSeen: Date.now() }));
    await assertFails(db.ref(`events/${E}/waiters/w1`).set({ name: 'Anna', lastSeen: Date.now(), role: 'admin' }));
    await assertFails(db.ref(`events/${E}/waiters/w1/name`).set(''));
  });
  it('is locked out for other events, after the link was rotated and after the event', async () => {
    await assertFails(staff('w1', { eventId: 'evB' }).ref(`events/${E}/orders`).get());
    await assertFails(staff('w1', { gen: 1 }).ref(`events/${E}/orders`).get());
    await assertFails(staff('w1', { until: Date.now() - 1 }).ref(`events/${E}/orders`).get());
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
