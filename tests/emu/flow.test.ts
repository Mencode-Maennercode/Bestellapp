import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { equalTo, get, orderByChild, query, ref, set } from 'firebase/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EventIndexEntry, Order, Stats, Table, TableStatusEntry } from '../../shared/types';
import { buildPlan } from '../../scripts/migrate-v2.ts';
import { ADMIN_PIN, Client, pinRecord, requestId, rulesEnv } from './helpers';

let env: RulesTestEnvironment;
const admin = new Client();
const guest = new Client();
const anna = new Client();
const ben = new Client();
const theke = new Client();
let eventId = '';
let code = '';
let tableId = '';
let tokens = { waiter: '', bar: '' };

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
  await Promise.all([admin, guest, anna, ben, theke].map(c => c.close()));
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
    tokens = await val(admin, `secrets/eventStaffToken/${eventId}`);
    expect(tokens.waiter).toHaveLength(24);
    expect(tokens.bar).toHaveLength(24);
    expect(tokens.waiter).not.toBe(tokens.bar);
  });

  it('refuses guest orders while the event is still a draft', async () => {
    expect(await guest.reason('createGuestOrder', { code, type: 'order', lines: [{ productId: 'koelsch', qty: 1 }], requestId: requestId() }))
      .toBe('eventEnded');
    await admin.call('updateEvent', { eventId, status: 'live' });
    expect((await val<Record<string, EventIndexEntry>>(admin, 'eventIndex'))[eventId].status).toBe('live');
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
      const { customToken, role } = await c.call<{ customToken: string; role: string }>('staffSession', { token: tokens.waiter });
      expect(role).toBe('waiter');
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

  it('a waiter call (stored without items) can be taken and done; the guest sees who comes', async () => {
    const { orderId } = await guest.call<{ orderId: string }>('createGuestOrder', { code, type: 'call', requestId: requestId() });
    expect(await anna.reason('orderAction', { eventId, orderId, action: 'claim' })).toBe('ok');
    expect(await adminRead<TableStatusEntry>(`events/${eventId}/tableStatus/${code}/${orderId}`)).toMatchObject({ type: 'call', status: 'accepted', waiterName: 'Anna' });
    expect(await anna.reason('orderAction', { eventId, orderId, action: 'serve' })).toBe('ok');
    const done = await adminRead<TableStatusEntry>(`events/${eventId}/tableStatus/${code}/${orderId}`);
    expect([done.status, typeof done.doneAt]).toEqual(['served', 'number']);
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

  it('private tabs are owned by the waiter and untouchable for colleagues', async () => {
    const { orderId } = await anna.call<{ orderId: string }>('createWaiterOrder', {
      eventId, type: 'tab', note: 'Fenster', sendToBar: false, lines: [{ productId: 'koelsch', qty: 2 }], requestId: requestId(),
    });
    const tab = await adminRead<Order>(`events/${eventId}/orders/${orderId}`);
    expect([tab.type, tab.sendToBar, tab.note, tab.claimedBy?.uid, tab.tableId]).toEqual(['tab', false, 'Fenster', annaUid, undefined]);
    expect([tab.wFeed, tab.bFeed]).toEqual([`w:${annaUid}`, undefined]);
    for (const action of ['claim', 'serve', 'cancel'] as const) {
      expect(await ben.reason('orderAction', { eventId, orderId, action })).toBe('notAllowed');
    }
  });
});

describe('bar link (separate from the waiter link)', () => {
  let annaUid = '';
  let tabForBar = '';
  let tabPrivate = '';
  const feed = (c: Client, child: 'wFeed' | 'bFeed', value: string) =>
    get(query(ref(c.db, `events/${eventId}/orders`), orderByChild(child), equalTo(value))).then(s => Object.keys((s.val() as object) ?? {}));

  it('opens with its own token and is no waiter', async () => {
    expect(await theke.reason('staffSession', { token: tokens.bar })).toBe('ok');
    const { customToken, role } = await theke.call<{ customToken: string; role: string }>('staffSession', { token: tokens.bar });
    expect(role).toBe('bar');
    await theke.signIn(customToken);
    const waiters = await adminRead<Record<string, { name: string }>>(`events/${eventId}/waiters`);
    annaUid = Object.entries(waiters).find(([, w]) => w.name === 'Anna')![0];
    expect(await theke.reason('createWaiterOrder', { eventId, type: 'tab', sendToBar: true, lines: [{ productId: 'cola', qty: 1 }], requestId: requestId() }))
      .toBe('notAllowed');
  });

  it('sees tabs sent to the bar, but not private tabs, and no waiter feeds', async () => {
    ({ orderId: tabForBar } = await anna.call<{ orderId: string }>('createWaiterOrder', {
      eventId, type: 'tab', note: 'Bühne', sendToBar: true, lines: [{ productId: 'cola', qty: 1 }], requestId: requestId(),
    }));
    ({ orderId: tabPrivate } = await anna.call<{ orderId: string }>('createWaiterOrder', {
      eventId, type: 'tab', note: 'geheim', sendToBar: false, lines: [{ productId: 'cola', qty: 1 }], requestId: requestId(),
    }));
    const seen = await feed(theke, 'bFeed', 'bar');
    expect(seen).toContain(tabForBar);
    expect(seen).not.toContain(tabPrivate);
    await expect(feed(theke, 'wFeed', 'all')).rejects.toThrow(/permission/i);
    await expect(feed(theke, 'wFeed', `w:${annaUid}`)).rejects.toThrow(/permission/i);
    await expect(get(ref(theke.db, `events/${eventId}/orders`))).rejects.toThrow(/permission/i);
  });

  it('waiters see colleagues\' shared orders but never their tabs, and not the bar feed', async () => {
    expect(await feed(ben, 'wFeed', 'all')).not.toContain(tabForBar);
    await expect(feed(ben, 'wFeed', `w:${annaUid}`)).rejects.toThrow(/permission/i);
    await expect(feed(ben, 'bFeed', 'bar')).rejects.toThrow(/permission/i);
    expect(await feed(anna, 'wFeed', `w:${annaUid}`)).toEqual(expect.arrayContaining([tabForBar, tabPrivate]));
  });

  it('may only mark bar orders ready — nothing else, and not private tabs', async () => {
    expect(await theke.reason('orderAction', { eventId, orderId: tabForBar, action: 'ready' })).toBe('ok');
    expect(await theke.reason('orderAction', { eventId, orderId: tabForBar, action: 'unready' })).toBe('ok');
    for (const action of ['claim', 'serve', 'cancel'] as const) {
      expect(await theke.reason('orderAction', { eventId, orderId: tabForBar, action })).toBe('notAllowed');
    }
    expect(await theke.reason('orderAction', { eventId, orderId: tabPrivate, action: 'ready' })).toBe('notAllowed');
  });

  it('shows the waiter link to the bar only', async () => {
    expect(await val<string>(theke, `secrets/eventStaffToken/${eventId}/waiter`)).toBe(tokens.waiter);
    await expect(get(ref(theke.db, `secrets/eventStaffToken/${eventId}/bar`))).rejects.toThrow(/permission/i);
    await expect(get(ref(ben.db, `secrets/eventStaffToken/${eventId}/waiter`))).rejects.toThrow(/permission/i);
  });

  it('rotating one link locks out only that role', async () => {
    await admin.call('rotateStaffLink', { eventId, role: 'waiter' });
    expect(await ben.reason('orderAction', { eventId, orderId: 'x', action: 'claim' })).toBe('linkRotated');
    expect(await ben.reason('staffSession', { token: tokens.waiter })).toBe('linkInvalid');
    expect(await theke.reason('orderAction', { eventId, orderId: tabForBar, action: 'ready' })).toBe('ok');
    const fresh = await val<{ waiter: string; bar: string }>(admin, `secrets/eventStaffToken/${eventId}`);
    expect(fresh.waiter).not.toBe(tokens.waiter);
    expect(fresh.bar).toBe(tokens.bar);
    tokens = fresh;
    await admin.call('rotateStaffLink', { eventId, role: 'bar' });
    expect(await theke.reason('orderAction', { eventId, orderId: tabForBar, action: 'unready' })).toBe('linkRotated');
    tokens = await val(admin, `secrets/eventStaffToken/${eventId}`);
  });
});

describe('event settings', () => {
  it('updateEvent validates, keeps the admin list in sync and rejects bad times', async () => {
    await admin.call('updateEvent', { eventId, name: 'Prunksitzung', slug: 'Prunksitzung-2027', accent: { primary: '#112233', secondary: '#FFCC00' } });
    const pub = await val<{ name: string; slug: string; accent: { primary: string } }>(admin, `events/${eventId}/public`);
    expect([pub.name, pub.slug, pub.accent.primary]).toEqual(['Prunksitzung', 'Prunksitzung-2027', '#112233']);
    expect((await val<Record<string, EventIndexEntry>>(admin, 'eventIndex'))[eventId].slug).toBe('Prunksitzung-2027');
    expect(await admin.reason('updateEvent', { eventId, endsAt: now - 10 * 3600_000 })).toBe('badTimes');
    expect(await admin.reason('updateEvent', { eventId, slug: 'a b/c' })).toBe('invalid');
    expect(await guest.reason('updateEvent', { eventId, name: 'Hack' })).toBe('adminRequired');
  });
});

describe('after the event', () => {
  let oldTokens = { waiter: '', bar: '' };
  let next = '';

  it('closing kills both links, their sessions and the guests\' status view', async () => {
    oldTokens = await val(admin, `secrets/eventStaffToken/${eventId}`);
    await admin.call('closeEvent', { eventId });

    expect(await guest.reason('staffSession', { token: oldTokens.waiter })).toBe('linkInvalid');
    expect(await guest.reason('staffSession', { token: oldTokens.bar })).toBe('linkInvalid');
    expect(await ben.reason('orderAction', { eventId, orderId: 'x', action: 'claim' })).toBe('linkRotated');
    expect(await theke.reason('orderAction', { eventId, orderId: 'x', action: 'ready' })).toBe('linkRotated');
    await expect(get(query(ref(ben.db, `events/${eventId}/orders`), orderByChild('wFeed'), equalTo('all')))).rejects.toThrow(/permission/i);
    await expect(get(query(ref(theke.db, `events/${eventId}/orders`), orderByChild('bFeed'), equalTo('bar')))).rejects.toThrow(/permission/i);

    expect(await guest.reason('createGuestOrder', { code, type: 'call', requestId: requestId() })).toBe('eventEnded');
    expect(await adminRead(`events/${eventId}/tableStatus`)).toBeNull();
    expect(await adminRead(`secrets/eventStaffToken/${eventId}`)).toBeNull();
    expect((await val<Record<string, EventIndexEntry>>(admin, 'eventIndex'))[eventId].status).toBe('closed');
    expect(await adminRead<Stats>(`events/${eventId}/stats`)).toMatchObject({ totalOrders: expect.any(Number) }); // statistics stay as archive
  });

  it('a closed event is final: no reopening, no new codes, no new links', async () => {
    expect(await admin.reason('updateEvent', { eventId, status: 'live' })).toBe('eventClosed');
    expect(await admin.reason('setTables', { eventId, tables: [{ label: '1' }] })).toBe('eventClosed');
    expect(await admin.reason('regenerateGuestCodes', { eventId })).toBe('eventClosed');
    expect(await admin.reason('rotateStaffLink', { eventId })).toBe('eventClosed');
    expect(await admin.reason('updateEvent', { eventId: 'gibtsnicht', name: 'x' })).toBe('eventNotFound');
  });

  it('a copied event gets new guest codes and new links; nothing of the old event works there', async () => {
    ({ eventId: next } = await admin.call<{ eventId: string }>('createEvent', {
      name: 'Nächste Woche', startsAt: now + 7 * 86400_000, endsAt: now + 7 * 86400_000 + 6 * 3600_000, mode: 'tables', copyFrom: eventId,
    }));
    const tables = await val<Record<string, Table>>(admin, `events/${next}/tables`);
    expect(Object.keys(tables)).toContain(tableId);
    expect(tables[tableId].guestCode).not.toBe(code);
    const link = await val<{ eventId: string }>(guest, `guestCodes/${code}`);
    expect(link.eventId).toBe(eventId); // old QR code still points to the closed event

    const fresh = await val<{ waiter: string; bar: string }>(admin, `secrets/eventStaffToken/${next}`);
    expect([fresh.waiter, fresh.bar]).not.toContain(oldTokens.waiter);
    expect([fresh.waiter, fresh.bar]).not.toContain(oldTokens.bar);
    expect(await val(admin, `events/${next}/gen`)).toEqual({ waiter: 0, bar: 0 });
    expect(await guest.reason('staffSession', { token: oldTokens.waiter })).toBe('linkInvalid');
  });

  it('old table code, old waiter and old bar session cannot order or read in the next event', async () => {
    await admin.call('updateEvent', { eventId: next, status: 'live', startsAt: now - 1000 });
    expect(await guest.reason('createGuestOrder', { code, type: 'call', requestId: requestId() })).toBe('eventEnded');
    const newCode = (await val<Record<string, Table>>(admin, `events/${next}/tables`))[tableId].guestCode;
    expect(await guest.reason('createGuestOrder', { code: newCode, type: 'call', requestId: requestId() })).toBe('ok');

    // The old sessions are bound to the old event and a rotated generation.
    expect(await anna.reason('createWaiterOrder', { eventId: next, type: 'order', tableId, lines: [{ productId: 'koelsch', qty: 1 }], requestId: requestId() }))
      .toBe('otherEvent');
    expect(await theke.reason('orderAction', { eventId: next, orderId: 'x', action: 'ready' })).toBe('otherEvent');
    await expect(get(query(ref(anna.db, `events/${next}/orders`), orderByChild('wFeed'), equalTo('all')))).rejects.toThrow(/permission/i);
    await expect(get(query(ref(theke.db, `events/${next}/orders`), orderByChild('bFeed'), equalTo('bar')))).rejects.toThrow(/permission/i);
    expect((await get(ref(guest.db, `events/${next}/tableStatus/${code}`))).exists()).toBe(false);
  });
});

describe('migrated archive event (scripts/migrate-v2.ts)', () => {
  it('has no live access, and duplicating it gives a working event with brand-new codes', async () => {
    const legacy = {
      tables: { a: { number: 12, code: 'A17B', isActive: true }, b: { number: 1001, code: 'C99D', name: '56a', isActive: true } },
      settings: { language: 'koelsch', theken: [{ id: 't1', name: 'Haupttheke', assignedTables: [12] }] },
      statistics: { totalOrders: 2, totalAmount: 9.5, itemTotals: { Kölsch: { quantity: 3, amount: 9.5 } }, tables: { 12: { totalOrders: 2, totalAmount: 9.5 } } },
    };
    const { writes } = buildPlan(legacy, { id: 'karneval-2026', name: 'Karneval 2026', startsAt: now - 9e9, endsAt: now - 8e9, history: false, now });
    await env.withSecurityRulesDisabled(ctx => ctx.database().ref().update(writes));

    // Closed and without any link or code: nothing of it can order or log in.
    expect(await adminRead('secrets/eventStaffToken/karneval-2026')).toBeNull();
    expect(await adminRead('guestCodes')).not.toHaveProperty('A17B');
    expect(await guest.reason('createGuestOrder', { code: 'AAAAAAAAAA', type: 'call', requestId: requestId() })).toBe('codeInvalid');

    const { eventId: copy } = await admin.call<{ eventId: string }>('createEvent', {
      name: 'Karneval 2027', startsAt: now + 86400_000, endsAt: now + 2 * 86400_000, mode: 'tables', copyFrom: 'karneval-2026',
    });
    const tables = await adminRead<Record<string, Table>>(`events/${copy}/tables`);
    expect(Object.values(tables).map(t => t.label).sort()).toEqual(['12', '56a']);
    for (const t of Object.values(tables)) expect(t.guestCode).toMatch(/^[23456789A-HJKMNP-Z]{10}$/);
    expect(await adminRead(`events/${copy}/stats`)).toBeNull(); // statistics are never copied
    expect((await adminRead<Record<string, unknown>>(`events/${copy}/catalog/products`)).koelsch).toMatchObject({ priceCents: 300, soldOut: false });
  });
});
