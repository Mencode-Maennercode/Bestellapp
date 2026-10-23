import type { Catalog, Product, TableSection } from '@shared/types';

export type Entry = [id: string, product: Product];

export interface TableGroup {
  section: TableSection;
  products: Entry[];
  fromCents: number;
}

export type MenuSection = { id: string; kind: 'grid'; title: string; products: Entry[] } | { id: 'tisch'; kind: 'table'; title: string; groups: TableGroup[] };

const SECTION_ORDER: TableSection[] = ['bottle-nonalc', 'beer-crate', 'wine-bottle', 'shots-crate'];

const bySort = (a: Entry, b: Entry) => a[1].sort - b[1].sort || a[1].name.localeCompare(b[1].name, 'de');

/** How often each product was ordered in this event (waiter view); most ordered first. */
export type Rank = Record<string, number>;

/** Most often ordered drinks shown under "Beliebt" in the waiter view. */
export const TOP_COUNT = 8;

/**
 * Menu layout: popular singles first, then shareable bottles and crates "for the table",
 * then every category with its single drinks. Bottles and crates live only in the table row.
 */
export function buildSections(catalog: Catalog, labels: { popular: string; forTable: string }, rank?: Rank): MenuSection[] {
  const qty = (e: Entry) => rank?.[e[0]] ?? 0;
  const order = rank ? (a: Entry, b: Entry) => qty(b) - qty(a) || bySort(a, b) : bySort;
  const entries = Object.entries(catalog.products).filter(([, p]) => p.active && catalog.categories[p.categoryId]?.active);
  const singles = entries.filter(([, p]) => !p.tableSection);
  const sections: MenuSection[] = [];

  // With order counts: the most ordered drinks first, topped up with the ones marked popular.
  const popular = rank
    ? singles
        .filter(e => !e[1].glassFor && (qty(e) > 0 || e[1].popular))
        .sort((a, b) => qty(b) - qty(a) || Number(!!b[1].popular) - Number(!!a[1].popular) || bySort(a, b))
        .slice(0, TOP_COUNT)
    : singles.filter(([, p]) => p.popular).sort(bySort);
  if (popular.length)
    sections.push({
      id: 'beliebt',
      kind: 'grid',
      title: labels.popular,
      products: popular,
    });

  const groups = SECTION_ORDER.map(section => {
    const products = entries.filter(([, p]) => p.tableSection === section).sort(order);
    const available = products.filter(([, p]) => !p.soldOut);
    const prices = (available.length ? available : products).map(([, p]) => p.priceCents);
    return { section, products, fromCents: Math.min(...prices) };
  }).filter(g => g.products.length);
  if (groups.length)
    sections.push({
      id: 'tisch',
      kind: 'table',
      title: labels.forTable,
      groups,
    });

  Object.entries(catalog.categories)
    .filter(([, c]) => c.active)
    .sort((a, b) => a[1].sort - b[1].sort)
    .forEach(([id, c]) => {
      const products = singles.filter(([, p]) => p.categoryId === id).sort(order);
      if (products.length) sections.push({ id, kind: 'grid', title: c.name, products });
    });

  return sections;
}
