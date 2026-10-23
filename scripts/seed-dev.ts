// Fills the local database emulator with a live demo event for UI work.
// Usage: npm run emu   (other terminal)   then   npm run seed:dev
// Prints guest, waiter, bar and admin links (admin PIN 123456). Options: --paused --shutdown --broadcast --hochdeutsch --two-bars --no-tables --empty.
// Never touches production: it only talks to 127.0.0.1.

import { createHash, randomBytes, scryptSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defaultCatalog } from '../shared/catalog-seed.ts';

const DB = 'http://127.0.0.1:9000';
const NS = 'demo-karneval';
const now = Date.now();
const H = 60 * 60 * 1000;

const tables: Record<string, { label: string; guestCode: string; sort: number }> = {
  t12: { label: '12', guestCode: 'DEM2TSCH2Z', sort: 12 },
  t56a: { label: '56a', guestCode: 'DEM2TSCH56', sort: 56 },
  t7: { label: '7', guestCode: 'DEM2TSCH7Z', sort: 7 },
};

const catalog = defaultCatalog();
catalog.products['glitter-pitter'].soldOut = true;

// Separate links: the waiter link and the bar link are different tokens with different access.
const WAITER_TOKEN = 'DEMXKEBESXZ2345678ABCDEF';
const BAR_TOKEN = 'DEMXTHEKEXZ2345678ABCDEF';
const ADMIN_PIN = '123456';
const M = 60 * 1000;
const item = (productId: string, qty: number) => {
  const p = catalog.products[productId];
  return { productId, name: p.name, priceCents: p.priceCents, qty };
};
const ben = { uid: 'staff-demo-ben', name: 'Ben' };
function order(o: Record<string, unknown> & { items: ReturnType<typeof item>[] }) {
  const totalCents = o.items.reduce((n, i) => n + i.priceCents * i.qty, 0);
  const status = o.readyAt ? 'ready' : o.claimedBy ? 'accepted' : 'new';
  const type = (o.type as string | undefined) ?? 'order';
  const sendToBar = (o.sendToBar as boolean | undefined) ?? type === 'order';
  // Feed keys as the functions write them: who may read the order (see database.rules.json).
  const wFeed = type === 'tab' ? `w:${o.waiterUid}` : 'all';
  const bFeed = sendToBar && type !== 'call' ? 'bar' : null;
  return { type: 'order', source: 'guest', sendToBar, totalCents, status, counted: !!o.readyAt, countedWaiter: o.readyAt ? ben.uid : null, open: true, wFeed, bFeed, ...o };
}
const orders = process.argv.includes('--empty') ? {} : {
  d1: order({ tableId: 't12', tableLabel: '12', guestCode: 'DEM2TSCH2Z', createdAt: now - 7.5 * M, items: [item('koelsch', 4), item('apfelschorle', 1)] }),
  d2: order({ tableId: 't7', tableLabel: '7', guestCode: 'DEM2TSCH7Z', createdAt: now - 4 * M, claimedBy: ben, claimedAt: now - 3 * M,
    items: [item('pils', 2), item('flasche-wein-blanc', 1), item('glas-wein-leer', 4)] }),
  d3: order({ type: 'call', tableId: 't12', tableLabel: '12', guestCode: 'DEM2TSCH2Z', sendToBar: false, createdAt: now - 50 * 1000, items: [] }),
  d4: order({ tableId: 't56a', tableLabel: '56a', guestCode: 'DEM2TSCH56', createdAt: now - 30 * 1000, items: [item('cola', 2), item('koelsch', 2)] }),
  d5: order({ tableId: 't7', tableLabel: '7', guestCode: 'DEM2TSCH7Z', createdAt: now - 9 * M, claimedBy: ben, claimedAt: now - 8 * M, readyAt: now - 1.5 * M,
    items: [item('koelsch', 6)] }),
  d6: order({ type: 'tab', source: 'waiter', waiterUid: ben.uid, waiterName: 'Ben', note: 'rote Jacke', sendToBar: true, claimedBy: ben, claimedAt: now - 2 * M,
    createdAt: now - 2 * M, items: [item('radler', 3), item('wasser', 1)] }),
  // Private bon: never sent to the bar, invisible to everybody but Ben.
  d7: order({ type: 'tab', source: 'waiter', waiterUid: ben.uid, waiterName: 'Ben', note: 'privat', sendToBar: false, claimedBy: ben, claimedAt: now - M,
    createdAt: now - M, items: [item('koelsch', 2)] }),
};

// Statistics of what is already counted (ready or served), exactly like orderAction books it.
const stats = { totalOrders: 0, totalCents: 0, byProduct: {} as Record<string, any>, byTable: {} as Record<string, any>, byWaiter: {} as Record<string, any> };
for (const o of Object.values(orders) as any[]) {
  if (!o.counted) continue;
  stats.totalOrders++;
  stats.totalCents += o.totalCents;
  const t = (stats.byTable[o.tableId] ??= { orders: 0, cents: 0 });
  t.orders++;
  t.cents += o.totalCents;
  const w = (stats.byWaiter[o.countedWaiter] ??= { orders: 0, cents: 0, name: 'Ben' });
  w.orders++;
  w.cents += o.totalCents;
  for (const i of o.items) {
    const p = (stats.byProduct[i.productId] ??= { name: i.name, qty: 0, cents: 0 });
    p.qty += i.qty;
    p.cents += i.qty * i.priceCents;
  }
}

const data = {
  guestCodes: Object.fromEntries(Object.entries(tables).map(([id, t]) => [t.guestCode, { eventId: 'demo', tableId: id }])),
  events: {
    demo: {
      public: {
        name: 'Prunksitzung Dorfgarde 2027',
        status: 'live',
        mode: process.argv.includes('--no-tables') ? 'noTables' : 'tables',
        startsAt: now - H,
        endsAt: now + 6 * H,
        language: process.argv.includes('--hochdeutsch') ? 'hochdeutsch' : 'koelsch',
        archiveMinutes: 10,
        accent: { primary: '#009640', secondary: '#FFCC00' },
      },
      gen: { waiter: 0, bar: 0 },
      catalog,
      tables,
      bars: process.argv.includes('--two-bars')
        ? { main: { name: 'Theke Saal', tableIds: [] }, side: { name: 'Theke Bühne', tableIds: ['t56a'] } }
        : { main: { name: 'Theke', tableIds: [] } },
      orders,
      stats,
      waiters: { [ben.uid]: { name: 'Ben', tableIds: ['t7'], lastSeen: now } },
      system: {
        shutdown: process.argv.includes('--shutdown'),
        ordersPaused: process.argv.includes('--paused'),
        ...(process.argv.includes('--broadcast')
          ? { broadcast: { message: 'Gleich zieht das Dreigestirn ein. Bitte die Gänge frei halten!', target: 'all', createdAt: now } }
          : {}),
      },
      tableStatus: {
        DEM2TSCH2Z: {
          a1: { type: 'order', status: 'accepted', summary: '4× Kölsch, 1× Apfelschorle', totalCents: 1450, waiterName: 'Anna', createdAt: now - 4 * 60 * 1000, doneAt: null },
          a2: { type: 'order', status: 'served', summary: '1× Flasche Wasser, 4× Bierglas (leer)', totalCents: 500, waiterName: 'Jupp', createdAt: now - 14 * 60 * 1000, doneAt: now - 3 * 60 * 1000 },
        },
      },
    },
  },
};

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const salt = randomBytes(16).toString('hex');
const secrets = {
  staffTokens: { [sha(WAITER_TOKEN)]: { eventId: 'demo', role: 'waiter' }, [sha(BAR_TOKEN)]: { eventId: 'demo', role: 'bar' } },
  eventStaffToken: { demo: { waiter: WAITER_TOKEN, bar: BAR_TOKEN } },
  adminPin: { salt, hash: scryptSync(ADMIN_PIN, salt, 32).toString('hex') },
};

// Admin event list, plus a closed archive event so the statistics screen has something to compare.
const demoPublic = data.events.demo.public;
const eventIndex = {
  demo: { name: demoPublic.name, status: demoPublic.status, mode: demoPublic.mode, startsAt: demoPublic.startsAt, endsAt: demoPublic.endsAt, createdAt: now - 3 * H },
  'karneval-2026': { name: 'Karneval 2026', status: 'closed', mode: 'tables', startsAt: now - 250 * 24 * H, endsAt: now - 244 * 24 * H, createdAt: now - 260 * 24 * H },
};
const archive = {
  public: { ...demoPublic, name: 'Karneval 2026', status: 'closed', startsAt: eventIndex['karneval-2026'].startsAt, endsAt: eventIndex['karneval-2026'].endsAt },
  catalog, tables: Object.fromEntries(Object.entries(tables).map(([id, t]) => [id, { ...t, guestCode: '' }])), bars: data.events.demo.bars, gen: { waiter: 1, bar: 1 },
  system: { shutdown: true, ordersPaused: true },
  stats: {
    totalOrders: 3, totalCents: 2140,
    byProduct: { koelsch: { name: 'Kölsch', qty: 4, cents: 1280 }, cola: { name: 'Cola', qty: 2, cents: 520 }, 'flasche-wein-blanc': { name: 'Flasche Blanc de noir', qty: 1, cents: 340 } },
    byTable: { t12: { orders: 2, cents: 1390 }, t7: { orders: 1, cents: 750 } },
    byWaiter: { _unbekannt: { orders: 3, cents: 2140, name: 'früher nicht erfasst' } },
  },
};

// The emulator only applies firebase.json rules to its default namespace; the app uses ?ns=${NS},
// so load the real rules there. Without this the preview would run with an open database.
const rules = await fetch(`${DB}/.settings/rules.json?ns=${NS}`, {
  method: 'PUT',
  headers: { Authorization: 'Bearer owner' },
  body: readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8'),
});
if (!rules.ok) throw new Error(`Rules failed: ${rules.status} ${await rules.text()}`);

const res = await fetch(`${DB}/.json?ns=${NS}`, {
  method: 'PUT',
  headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
  body: JSON.stringify({ ...data, events: { ...data.events, 'karneval-2026': archive }, eventIndex, secrets }),
});
if (!res.ok) throw new Error(`Seed failed: ${res.status} ${await res.text()}`);

for (const t of Object.values(tables)) console.log(`Tisch ${t.label}: http://localhost:5173/Buchungssystem/tisch/#${t.guestCode}`);
console.log(`Kellner:  http://localhost:5173/Buchungssystem/kellner/#${WAITER_TOKEN}`);
console.log(`Theke:    http://localhost:5173/Buchungssystem/theke/#${BAR_TOKEN}`);
console.log(`Admin:    http://localhost:5173/Buchungssystem/admin/   (PIN ${ADMIN_PIN})`);
