import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { get, ref, set, update } from 'firebase/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Order, Stats, Table, TableStatusEntry } from '../../shared/types';
import { ADMIN_PIN, Client, pinRecord, requestId, rulesEnv } from './helpers';

let env: RulesTestEnvironment;
const admin = new Client();
const guest = new Client();
const anna = new Client();
const ben = new Client();
let eventId = '';
let code = '';
let tableId = '';
let staffToken = '';

const now = Date.now();
const val = async <T>(c: Client, path: string) => (await get(ref(c.db, path))).val() as T;
async function adminRead<T>(path: string): Promise<T> {
  let out: T | undefined;
  await env.withSecurityRulesDisabled(async ctx => {
    out = (await ctx.database().ref(path).get()).val() as T;
  });
  return out as T;
}

beforeAll(async () => {
  env = await rulesEnv();
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(ctx => ctx.database().ref('secrets/adminPin').set(pinRecord(ADMIN_PIN)));
});
afterAll(async () => {
  await Promise.all([admin, guest, anna, ben].map(c => c.close()));
  await env.cleanup();
});

describe('admin session', () => {
  it('rejects a wrong PIN and locks after 5 attempts per device', async () => {
    const attacker = new Client();
    for (let i = 0; i < 5; i++) expect(await attacker.reason('adminSession', { pin: '000000' })).toBe('wrongPin');
    expect(await attacker.reason('adminSession', { pin: ADMIN_PIN })).toBe('tooManyAttempts');
    await attacker.close();
    // Unlock for the rest of the suite (all emulator calls share one IP).
    await env.withSecurityRulesDisabled(ctx => ctx.database().ref('secrets/adminFails').remove());
  });

  it('accepts the right PIN', async () => {
    const { customToken } = await admin.call<{ customToken: string }>('adminSession', { pin: ADMIN_PIN });
    await admin.signIn(customToken);
  });
});

describe('event setup', () => {
  it('creates an event with tables, codes and a staff link', async () => {
    ({ eventId } = await admin.call<{ eventId: string }>('createEvent', {
      name: 'Sitzung', startsAt: now - 1000, endsAt: now + 6 * 3600_000, mode: 'tables',
    }));
    await admin.call('setTables', { eventId, tables: [{ label: '12' }, { label: '56a' }] });
    const tables = await val<Record<string, Table>>(admin, `events/${eventId}/tables`);
    [tableId, { guestCode: code }] = Object.entries(tables)[0] as [string, Table];
    expect(code).toMatch(/^[23456789A-HJKMNP-Z]{10}$/);
    staffToken = await val<string>(admin, `secrets/eventStaffToken/${eventId}`);
    expect(staffToken).toHaveLength(24);
  });

  it('refuses guest orders while the event is still a draft', async () => {
    expect(await guest.reason('createGuestOrder', { code, type: 'order', lines: [{ productId: 'koelsch', qty: 1 }], requestId: requestId() }))
      .toBe('eventEnded');
    await set(ref(admin.db, `events/${eventId}/public/status`), 'live');
  });
});

describe('guest ordering', () => {
  let orderId = '';

  it('prices on the server and ignores client prices', async () => {
    const id = requestId();
    ({ orderId } = await guest.call<{ orderId: string }>('createGuestOrder', {
      code, type: 'order', requestId: id,
      lines: [{ productId: 'koelsch', qty: 3, priceCents: 1 }, { productId: 'cola', qty: 1 }],
      totalCents: 1,
    }));
    const order = await adminRead<Order>(`events/${eventId}/orders/${orderId}`);
    expect(order.totalCents).toBe(1150);
    expect(order.items.find(i => i.productId === 'koelsch')?.priceCents).toBe(300);
    const status = await val<TableStatusEntry>(guest, `events/${eventId}/tableStatus/${code}/${orderId}`);
    expect(status.status).toBe('new');
  });

  it('returns the same order for a retried request instead of a duplicate', async () => {
    const again = await guest.call<{ orderId: string }>('createGuestOrder', {
      code, type: 'order', requestId: orderId, lines: [{ productId: 'koelsch', qty: 3 }],
    });
    expect(again.orderId).toBe(orderId);
  });

  it('rate-limits orders per table and waiter calls', async () => {
    expect(await guest.reason('createGuestOrder', { code, type: 'order', lines: [{ productId: 'pils', qty: 1 }], requestId: requestId() }))
      .toBe('cooldown');
    expect(await guest.reason('createGuestOrder', { code, type: 'call', requestId: requestId() })).toBe('ok');
    expect(await guest.reason('createGuestOrder', { code, type: 'call', requestId: requestId() })).toBe('cooldown');
  });

  it('rejects unknown codes, sold-out products and paused ordering', async () => {
    expect(await guest.reason('createGuestOrder', { code: 'ZZZZZZZZZZ', type: 'call', requestId: requestId() })).toBe('codeInvalid');
    await set(ref(admin.db, `events/${eventId}/catalog/products/sprite/soldOut`), true);
    await env.withSecurityRulesDisabled(ctx => ctx.database().ref(`events/${eventId}/limits`).remove());
    expect(await guest.reason('createGuestOrder', { code, type: 'order', lines: [{ productId: 'sprite', qty: 1 }], requestId: requestId() }))
      .toBe('soldOut');
    await set(ref(admin.db, `events/${eventId}/system/ordersPaused`), true);
    expect(await guest.reason('createGuestOrder', { code, type: 'order', lines: [{ productId: 'pils', qty: 1 }], requestId: requestId() }))
      .toBe('ordersPaused');
    await set(ref(admin.db, `events/${eventId}/system/ordersPaused`), false);
  });
});

describe('waiter flow', () => {
  let annaUid = '';
  let benUid = '';

  it('joins with the link only (no login) and sets a name', async () => {
    for (const [c, name] of [[anna, 'Anna'], [ben, 'Ben']] as const) {
      const { customToken } = await c.call<{ customToken: string }>('staffSession', { token: staffToken });
      const uid = await c.signIn(customToken);
      await set(ref(c.db, `events/${eventId}/waiters/${uid}`), { name, tableIds: [tableId], lastSeen: Date.now() });
      if (name === 'Anna') annaUid = uid;
      else benUid = uid;
    }
    expect(annaUid).not.toBe(benUid);
  });

  it('only one of two simultaneous claims wins', async () => {
    const { orderId } = await guest.call<{ orderId: string }>('createGuestOrder', {
      code, type: 'order', lines: [{ productId: 'pils', qty: 2 }], requestId: requestId(),
    });
    const results = await Promise.all([
      anna.reason('orderAction', { eventId, orderId, action: 'claim' }),
      ben.reason('orderAction', { eventId, orderId, action: 'claim' }),
    ]);
    expect(results.sort()).toEqual(['claimedByOther', 'ok']);
  });

  it('keeps statistics exact under 20 parallel completions incl. undo', async () => {
    const before = (await adminRead<Stats>(`events/${eventId}/stats`)) ?? { totalCents: 0, totalOrders: 0 };
    const ids = await Promise.all(Array.from({ length: 20 }, () =>
      anna.call<{ orderId: string }>('createWaiterOrder', {
        eventId, type: 'order', tableId, lines: [{ productId: 'koelsch', qty: 1 }, { productId: 'glas-secco', qty: 1 }], requestId: requestId(),
      }).then(r => r.orderId)));
    await Promise.all(ids.map(orderId => anna.call('orderAction', { eventId, orderId, action: 'serve' })));
    // Bar marks a few as ready afterwards: must not count twice.
    await Promise.all(ids.slice(0, 5).map(orderId => anna.reason('orderAction', { eventId, orderId, action: 'ready' })));
    // Undo two serves: they leave the statistics again.
    await Promise.all(ids.slice(18).map(orderId => anna.call('orderAction', { eventId, orderId, action: 'unserve' })));

    const after = await adminRead<Stats>(`events/${eventId}/stats`);
    expect(after.totalOrders - (before.totalOrders ?? 0)).toBe(18);
    expect(after.totalCents - (before.totalCents ?? 0)).toBe(18 * 900);
    expect(after.byWaiter[annaUid].name).toBe('Anna');
  });

  it('private tabs are owned by the waiter and never go to the bar when disabled', async () => {
    const { orderId } = await anna.call<{ orderId: string }>('createWaiterOrder', {
      eventId, type: 'tab', note: 'Fenster', sendToBar: false, lines: [{ productId: 'koelsch', qty: 2 }], requestId: requestId(),
    });
    const tab = await adminRead<Order>(`events/${eventId}/orders/${orderId}`);
    expect([tab.type, tab.sendToBar, tab.note, tab.claimedBy?.uid, tab.tableId]).toEqual(['tab', false, 'Fenster', annaUid, undefined]);
    expect(await ben.reason('orderAction', { eventId, orderId, action: 'serve' })).toBe('claimedByOther');
  });

  it('rotating the link locks out existing devices immediately', async () => {
    await admin.call('rotateStaffLink', { eventId });
    expect(await ben.reason('orderAction', { eventId, orderId: 'x', action: 'claim' })).toBe('linkRotated');
    expect(await ben.reason('staffSession', { token: staffToken })).toBe('linkInvalid');
  });
});

describe('after the event', () => {
  it('blocks guests and staff links once the event is closed', async () => {
    const newToken = await val<string>(admin, `secrets/eventStaffToken/${eventId}`);
    await update(ref(admin.db, `events/${eventId}/public`), { status: 'closed' });
    await env.withSecurityRulesDisabled(ctx => ctx.database().ref(`events/${eventId}/limits`).remove());
    expect(await guest.reason('createGuestOrder', { code, type: 'call', requestId: requestId() })).toBe('eventEnded');
    expect(await guest.reason('staffSession', { token: newToken })).toBe('eventEnded');
  });

  it('a copied event gets new guest codes so old QR codes cannot order', async () => {
    const { eventId: next } = await admin.call<{ eventId: string }>('createEvent', {
      name: 'Nächste Woche', startsAt: now + 7 * 86400_000, endsAt: now + 7 * 86400_000 + 6 * 3600_000, mode: 'tables', copyFrom: eventId,
    });
    const tables = await val<Record<string, Table>>(admin, `events/${next}/tables`);
    expect(Object.keys(tables)).toContain(tableId);
    expect(tables[tableId].guestCode).not.toBe(code);
    const link = await val<{ eventId: string }>(guest, `guestCodes/${code}`);
    expect(link.eventId).toBe(eventId); // old code still points to the closed event
  });
});
