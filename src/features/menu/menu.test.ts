import { describe, expect, it } from 'vitest';
import { defaultCatalog } from '@shared/catalog-seed';
import { buildSections } from './sections';
import { cartCount, cartTotal, toLines } from './useCart';

const labels = { popular: 'Beliebt', forTable: 'Für den Tisch' };

describe('menu sections', () => {
  it('puts popular first, then the table row, then categories without bottles and crates', () => {
    const sections = buildSections(defaultCatalog(), labels);
    expect(sections.map(s => s.id)).toEqual(['beliebt', 'tisch', 'softdrinks', 'bier', 'wein', 'kurze', 'glaeser']);
    const bier = sections.find(s => s.id === 'bier');
    expect(bier?.kind === 'grid' && bier.products.map(([id]) => id)).not.toContain('kiste-bier-koelsch');
    const table = sections.find(s => s.id === 'tisch');
    expect(table?.kind === 'table' && table.groups.map(g => [g.section, g.fromCents])).toEqual([
      ['bottle-nonalc', 500],
      ['beer-crate', 6000],
      ['wine-bottle', 1800],
      ['shots-crate', 5000],
    ]);
  });

  it('hides inactive products and categories', () => {
    const c = defaultCatalog();
    c.categories.kurze.active = false;
    c.products.koelsch.active = false;
    const sections = buildSections(c, labels);
    expect(sections.some(s => s.id === 'kurze')).toBe(false);
    expect(sections.flatMap(s => (s.kind === 'grid' ? s.products.map(([id]) => id) : []))).not.toContain('koelsch');
  });

  it('"ab" price ignores sold-out bottles while others are available', () => {
    const c = defaultCatalog();
    c.products['flasche-secco'].soldOut = true;
    const table = buildSections(c, labels).find(s => s.id === 'tisch');
    expect(table?.kind === 'table' && table.groups.find(g => g.section === 'wine-bottle')?.fromCents).toBe(2000);
  });
});

describe('cart helpers', () => {
  const c = defaultCatalog();
  const cart = { koelsch: 3, 'flasche-sekt': 1, 'glas-sekt-leer': 4 };

  it('counts drinks without empty glasses and sums in cents', () => {
    expect(cartCount(cart, c)).toBe(4);
    expect(cartTotal(cart, c)).toBe(3 * 300 + 2200);
  });

  it('sends only product ids and quantities, never prices', () => {
    expect(toLines({ ...cart, cola: 0 })).toEqual([
      { productId: 'koelsch', qty: 3 },
      { productId: 'flasche-sekt', qty: 1 },
      { productId: 'glas-sekt-leer', qty: 4 },
    ]);
  });
});
