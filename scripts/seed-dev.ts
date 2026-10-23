// Fills the local database emulator with a live demo event for UI work.
// Usage: npm run emu   (other terminal)   then   npm run seed:dev
// Prints guest and staff links. Options: --paused --shutdown --broadcast --hochdeutsch --two-bars --no-tables --empty.
// Never touches production: it only talks to 127.0.0.1.

import { createHash } from 'node:crypto';
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

// One staff link for waiters and bar (same token, the path picks the view).
const STAFF_TOKEN = 'DEMXPERSXNAZ234567ABCDEF';
const M = 60 * 1000;
const item = (productId: string, qty: number) => {
  const p = catalog.products[productId];
  return { productId, name: p.name, priceCents: p.priceCents, qty };
};
const ben = { uid: 'staff-demo-ben', name: 'Ben' };
function order(o: Record<string, unknown> & { items: ReturnType<typeof item>[] }) {
  const totalCents = o.items.reduce((n, i) => n + i.priceCents * i.qty, 0);
  const status = o.readyAt ? 'ready' : o.claimedBy ? 'accepted' : 'new';
  return { type: 'order', source: 'guest', sendToBar: true, totalCents, status, counted: !!o.readyAt, countedWaiter: o.readyAt ? ben.uid : null, open: true, ...o };
}
const orders = process.argv.includes('--empty') ? {} : {
  d1: order({ tableId: 't12', tableLabel: '12', guestCode: 'DEM2TSCH2Z', createdAt: now - 7.5 * M, items: [item('koelsch', 4), item('apfelschorle', 1)] }),
  d2: order({ tableId: 't7', tableLabel: '7', guestCode: 'DEM2TSCH7Z', createdAt: now - 4 * M, claimedBy: ben, claimedAt: now - 3 * M,
    items: [item('pils', 2), item('flasche-wein-blanc', 1), item('glas-wein-leer', 4)] }),
  d3: order({ type: 'call', tableId: 't12', tableLabel: '12', guestCode: 'DEM2TSCH2Z', sendToBar: false, createdAt: now - 50 * 1000, items: [] }),
  d4: order({ tableId: 't56a', tableLabel: '56a', guestCode: 'DEM2TSCH56', createdAt: now - 30 * 1000, items: [item('cola', 2), item('koelsch', 2)] }),
  d5: order({ tableId: 't7', tableLabel: '7', guestCode: 'DEM2TSCH7Z', createdAt: now - 9 * M, claimedBy: ben, claimedAt: now - 8 * M, readyAt: now - 1.5 * M,
    items: [item('koelsch', 6)] }),
  d6: order({ type: 'tab', source: 'waiter', waiterUid: ben.uid, waiterName: 'Ben', note: 'rote Jacke', claimedBy: ben, claimedAt: now - 2 * M,
    createdAt: now - 2 * M, items: [item('radler', 3), item('wasser', 1)] }),
};

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
      staffGen: 0,
      catalog,
      tables,
      bars: process.argv.includes('--two-bars')
        ? { main: { name: 'Theke Saal', tableIds: [] }, side: { name: 'Theke Bühne', tableIds: ['t56a'] } }
        : { main: { name: 'Theke', tableIds: [] } },
      orders,
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

const secrets = { staffTokens: { [createHash('sha256').update(STAFF_TOKEN).digest('hex')]: { eventId: 'demo' } }, eventStaffToken: { demo: STAFF_TOKEN } };

const res = await fetch(`${DB}/.json?ns=${NS}`, {
  method: 'PUT',
  headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
  body: JSON.stringify({ ...data, secrets }),
});
if (!res.ok) throw new Error(`Seed failed: ${res.status} ${await res.text()}`);

for (const t of Object.values(tables)) console.log(`Tisch ${t.label}: http://localhost:5173/Buchungssystem/tisch/#${t.guestCode}`);
console.log(`Kellner:  http://localhost:5173/Buchungssystem/kellner/#${STAFF_TOKEN}`);
console.log(`Theke:    http://localhost:5173/Buchungssystem/theke/#${STAFF_TOKEN}`);
