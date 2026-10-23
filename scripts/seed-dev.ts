// Fills the local database emulator with a live demo event for UI work.
// Usage: npm run emu   (other terminal)   then   npm run seed:dev
// Prints the guest links. Never touches production: it only talks to 127.0.0.1.

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

const data = {
  guestCodes: Object.fromEntries(Object.entries(tables).map(([id, t]) => [t.guestCode, { eventId: 'demo', tableId: id }])),
  events: {
    demo: {
      public: {
        name: 'Prunksitzung Dorfgarde 2027',
        status: 'live',
        mode: 'tables',
        startsAt: now - H,
        endsAt: now + 6 * H,
        language: process.argv.includes('--hochdeutsch') ? 'hochdeutsch' : 'koelsch',
        archiveMinutes: 10,
        accent: { primary: '#009640', secondary: '#FFCC00' },
      },
      staffGen: 0,
      catalog,
      tables,
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

const res = await fetch(`${DB}/.json?ns=${NS}`, {
  method: 'PUT',
  headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});
if (!res.ok) throw new Error(`Seed failed: ${res.status} ${await res.text()}`);

for (const t of Object.values(tables)) console.log(`Tisch ${t.label}: http://localhost:5173/Buchungssystem/tisch/#${t.guestCode}`);
