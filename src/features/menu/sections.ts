import type { Catalog, Product, TableSection } from '@shared/types';

export type Entry = [id: string, product: Product];

export interface TableGroup {
  section: TableSection;
  products: Entry[];
  fromCents: number;
}

export type MenuSection =
  | { id: string; kind: 'grid'; title: string; products: Entry[] }
  | { id: 'tisch'; kind: 'table'; title: string; groups: TableGroup[] };

const SECTION_ORDER: TableSection[] = ['bottle-nonalc', 'beer-crate', 'wine-bottle', 'shots-crate'];

const bySort = (a: Entry, b: Entry) => a[1].sort - b[1].sort || a[1].name.localeCompare(b[1].name, 'de');

/**
 * Menu layout: popular singles first, then shareable bottles and crates "for the table",
 * then every category with its single drinks. Bottles and crates live only in the table row.
 */
export function buildSections(catalog: Catalog, labels: { popular: string; forTable: string }): MenuSection[] {
  const entries = Object.entries(catalog.products).filter(([, p]) => p.active && catalog.categories[p.categoryId]?.active);
  const singles = entries.filter(([, p]) => !p.tableSection);
  const sections: MenuSection[] = [];

  const popular = singles.filter(([, p]) => p.popular).sort(bySort);
  if (popular.length) sections.push({ id: 'beliebt', kind: 'grid', title: labels.popular, products: popular });

  const groups = SECTION_ORDER.map(section => {
    const products = entries.filter(([, p]) => p.tableSection === section).sort(bySort);
    const available = products.filter(([, p]) => !p.soldOut);
    const prices = (available.length ? available : products).map(([, p]) => p.priceCents);
    return { section, products, fromCents: Math.min(...prices) };
  }).filter(g => g.products.length);
  if (groups.length) sections.push({ id: 'tisch', kind: 'table', title: labels.forTable, groups });

  Object.entries(catalog.categories)
    .filter(([, c]) => c.active)
    .sort((a, b) => a[1].sort - b[1].sort)
    .forEach(([id, c]) => {
      const products = singles.filter(([, p]) => p.categoryId === id).sort(bySort);
      if (products.length) sections.push({ id, kind: 'grid', title: c.name, products });
    });

  return sections;
}
