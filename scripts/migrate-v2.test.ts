import { describe, expect, it } from 'vitest';
import { buildPlan, slugify, type Options } from './migrate-v2.ts';

const opts: Options = { id: 'karneval-2026', name: 'Karneval 2026', startsAt: 1_770_000_000_000, endsAt: 1_770_500_000_000, history: false, now: 1_790_000_000_000 };

// A trimmed export in the shape of the old app's database.
const legacy = {
  config: { menu: { items: { koelsch: { isPopular: true, price: 3.2, isSoldOut: true }, cola: { isPopular: true, name: 'Coca', price: 2.6 } } } },
  database: {
    categories: { categories: { shots: { name: 'Shots', emoji: '🥃', isActive: true }, alt: { name: 'Alt', isActive: false, deletedAt: 5 } }, order: ['bier', 'softdrinks'] },
    drinks: { drinks: { 'mein-saft': { name: 'Mein Saft', price: 3.1, category: 'shots', size: '0,2l' } } },
  },
  tables: {
    a: { number: 12, code: 'A17B', isActive: true },
    b: { number: 56, code: 'C99D', isActive: true },
    c: { number: 1001, code: 'E11F', name: '56a', isActive: true },
    d: { number: 7, code: 'X', isActive: false },
  },
  settings: {
    language: 'hochdeutsch',
    colors: { primaryTisch: '#112233', secondaryTisch: 'kaputt' },
    orderAutoHideMinutes: 6,
    theken: [{ id: 'theke-main', name: 'Haupttheke', assignedTables: [12] }, { id: 'theke-2', name: 'Bühne', assignedTables: [56, 1001] }],
    pinProtection: { adminPin: 'geheim' },
  },
  statistics: {
    totalOrders: 3,
    totalAmount: 21.4,
    itemTotals: { Kölsch: { quantity: 4, amount: 12.8 }, Coca: { quantity: 2, amount: 5.2 }, 'Mein Saft': { quantity: 1, amount: 3.1 }, 'Alter Wein': { quantity: 1, amount: 0.3 } },
    tables: { 12: { totalOrders: 2, totalAmount: 13.9 }, 56: { totalOrders: 1, totalAmount: 7.5 }, 99: { totalOrders: 0, totalAmount: 0 } },
  },
  statisticsHistory: { h1: { timestamp: 1_769_000_000_000, statistics: { totalOrders: 1, totalAmount: 6, itemTotals: { Kölsch: { quantity: 2, amount: 6 } }, tables: { 12: { totalOrders: 1, totalAmount: 6 } } } } },
  ratings: {
    r1: { rating: 5, name: 'Anna', email: 'a@example.org', message: 'Super', timestamp: 1_770_100_000_000, tableCode: 'A17B' },
    r2: { rating: 9, name: 'Falsch' },
  },
  orders: { o1: { total: 3 } },
};

describe('migrate-v2', () => {
  const { writes, report } = buildPlan(legacy, opts);
  const w = <T>(path: string) => writes[path] as T;

  it('creates one closed archive event without any live access', () => {
    expect(w<{ status: string; language: string; archiveMinutes: number; accent: unknown }>('events/karneval-2026/public')).toMatchObject({
      status: 'closed', language: 'hochdeutsch', archiveMinutes: 6, accent: { primary: '#112233', secondary: '#FFCC00' },
    });
    expect(w<{ status: string }>('eventIndex/karneval-2026').status).toBe('closed');
    expect(w('events/karneval-2026/gen')).toEqual({ waiter: 1, bar: 1 });
    const keys = Object.keys(writes);
    expect(keys.some(k => k.startsWith('guestCodes') || k.startsWith('secrets'))).toBe(false);
  });

  it('never carries over table codes or PINs', () => {
    const tables = w<Record<string, { label: string; guestCode: string }>>('events/karneval-2026/tables');
    expect(Object.values(tables).every(t => t.guestCode === '')).toBe(true);
    expect(JSON.stringify(writes)).not.toMatch(/A17B|C99D|E11F|geheim/);
  });

  it('keeps tables from the table list and the statistics, with readable labels', () => {
    const tables = w<Record<string, { label: string; sort: number }>>('events/karneval-2026/tables');
    expect(Object.keys(tables).sort()).toEqual(['t-56a', 't12', 't56', 't99']);
    expect(tables['t-56a'].label).toBe('56a');
    expect(tables.t7).toBeUndefined(); // inactive
  });

  it('maps bars to the new table ids', () => {
    expect(w('events/karneval-2026/bars')).toEqual({
      'theke-main': { name: 'Haupttheke', tableIds: ['t12'] },
      'theke-2': { name: 'Bühne', tableIds: ['t56', 't-56a'] },
    });
  });

  it('applies price and name changes, custom drinks and categories; sold-out is reset', () => {
    const c = w<{ products: Record<string, any>; categories: Record<string, any> }>('events/karneval-2026/catalog');
    expect(c.products.koelsch).toMatchObject({ priceCents: 320, soldOut: false, popular: true });
    expect(c.products.cola).toMatchObject({ name: 'Coca', priceCents: 260 });
    expect(c.products['mein-saft']).toMatchObject({ name: 'Mein Saft', priceCents: 310, categoryId: 'shots', size: '0,2l' });
    expect(c.categories.shots.name).toBe('Shots');
    expect(c.categories.alt).toBeUndefined();
    expect(c.categories.bier.sort).toBe(1);
    expect(c.categories.softdrinks.sort).toBe(2);
  });

  it('converts statistics to exact cents keyed by product id', () => {
    const s = w<any>('events/karneval-2026/stats');
    expect(s.totalCents).toBe(2140);
    expect(s.totalOrders).toBe(3);
    expect(s.byProduct.koelsch).toEqual({ name: 'Kölsch', qty: 4, cents: 1280 });
    expect(s.byProduct.cola).toMatchObject({ qty: 2, cents: 520 }); // found through the renamed product
    expect(s.byProduct['mein-saft'].cents).toBe(310);
    expect(s.byProduct['legacy-alter-wein']).toMatchObject({ qty: 1, cents: 30 });
    expect(s.byTable.t12).toEqual({ orders: 2, cents: 1390 });
    expect(s.byWaiter._unbekannt).toMatchObject({ orders: 3, cents: 2140 });
    // 12.80 + 5.20 + 3.10 + 0.30 = 21.40 → no drift from float arithmetic.
    expect(Object.values(s.byProduct as Record<string, { cents: number }>).reduce((n, p) => n + p.cents, 0)).toBe(2140);
  });

  it('migrates valid ratings only, without table codes', () => {
    const f = Object.entries(writes).filter(([k]) => k.startsWith('feedback/'));
    expect(f).toHaveLength(1);
    expect(f[0][1]).toEqual({ rating: 5, name: 'Anna', email: 'a@example.org', message: 'Super', eventId: 'karneval-2026', createdAt: 1_770_100_000_000 });
  });

  it('warns about open orders and leaves the history alone unless asked', () => {
    expect(report.join('\n')).toMatch(/1 noch offene Bestellungen/);
    expect(report.join('\n')).toMatch(/1 ältere Statistik-Stände/);
    expect(Object.keys(writes).some(k => k.includes('archiv'))).toBe(false);
    const withHistory = buildPlan(legacy, { ...opts, history: true }).writes;
    expect((withHistory['events/karneval-2026-archiv-1/stats'] as { totalCents: number }).totalCents).toBe(600);
  });

  it('slugifies German text for ids', () => {
    expect(slugify('Größe Äpfel & Öl!')).toBe('groesse-aepfel-oel');
  });
});
