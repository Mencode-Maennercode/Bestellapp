import { describe, expect, it } from 'vitest';
import { commissionCents, consistency, linesToCsv, plainEUR, productLines, tableLines, toCsv, waiterLines } from './admin-stats';
import { slugify, uniqueId } from './slug';
import type { Stats } from './types';

const stats: Stats = {
  totalOrders: 3,
  totalCents: 2140,
  byProduct: {
    koelsch: { name: 'Kölsch', qty: 4, cents: 1280 },
    cola: { name: 'Cola "Zero"', qty: 2, cents: 520 },
    saft: { name: 'Saft', qty: 1, cents: 340 },
  },
  byTable: { t12: { orders: 2, cents: 1390 }, _ohneTisch: { orders: 1, cents: 750 } },
  byWaiter: { u1: { orders: 2, cents: 1390, name: 'Anna' }, u2: { orders: 1, cents: 750, name: 'Ben' } },
};

describe('admin statistics', () => {
  it('ranks products by revenue and labels tables', () => {
    expect(productLines(stats).map(l => l.id)).toEqual(['koelsch', 'cola', 'saft']);
    expect(tableLines(stats, { t12: { label: '12' } }).map(l => l.name)).toEqual(['12', 'Ohne Tisch (Bons)']);
    expect(waiterLines(stats)[0]).toMatchObject({ name: 'Anna', cents: 1390 });
  });
  it('copes with missing branches (nothing booked yet)', () => {
    expect(productLines(null)).toEqual([]);
    expect(consistency({ totalOrders: 0, totalCents: 0 } as Stats).ok).toBe(true);
  });
  it('detects when the breakdowns do not add up to the total', () => {
    expect(consistency(stats).ok).toBe(true);
    expect(consistency({ ...stats, totalCents: 2141 }).ok).toBe(false);
  });
  it('computes the 1.5 % share in cents', () => {
    expect(commissionCents(2140)).toBe(32); // 32.1
    expect(commissionCents(100000)).toBe(1500);
  });
  it('writes German CSV: semicolons, decimal comma, quotes escaped, BOM, no formula injection', () => {
    expect(plainEUR(1280)).toBe('12,80');
    expect(plainEUR(5)).toBe('0,05');
    const csv = linesToCsv('Artikel', 'Stück', productLines(stats));
    expect(csv.startsWith('﻿Artikel;Stück;Umsatz (EUR)\r\n')).toBe(true);
    expect(csv).toContain('"Cola ""Zero""";2;5,20');
    const injected = toCsv(['a'], [['=SUMME(1)'], ['-5'], ['-x']]).split('\r\n');
    expect(injected.slice(1, 4)).toEqual(["'=SUMME(1)", '-5', "'-x"]);
  });
});

describe('ids', () => {
  it('slugifies and de-duplicates', () => {
    expect(slugify('Große Äpfel!')).toBe('grosse-aepfel');
    expect(uniqueId('cola', ['cola', 'cola-2'])).toBe('cola-3');
    expect(uniqueId('neu', ['cola'])).toBe('neu');
  });
});
