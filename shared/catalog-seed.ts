import type { Catalog, Category, GlassType, Product, TableSection } from './types';

// Default catalog for a brand-new event (taken from the 2026 menu).
// Existing events copy their own catalog instead.

const categories: Record<string, Category> = {
  softdrinks: { name: 'Softdrinks', sort: 1, active: true },
  bier: { name: 'Bier', sort: 2, active: true },
  wein: { name: 'Wein & Sekt', sort: 3, active: true },
  kurze: { name: 'Kurze', sort: 4, active: true },
  glaeser: { name: 'Gläser', sort: 5, active: true },
};

type Seed = [
  id: string,
  name: string,
  categoryId: string,
  priceCents: number,
  extra?: Partial<Product> & { glass?: GlassType; section?: TableSection },
];

const seeds: Seed[] = [
  ['cola', 'Cola', 'softdrinks', 250, { size: '0,2 l', popular: true }],
  ['cola-zero', 'Cola Zero', 'softdrinks', 250, { size: '0,2 l', image: 'cola', badge: 'Zero' }],
  ['sprite', 'Sprite', 'softdrinks', 250, { size: '0,2 l' }],
  ['fanta', 'Fanta', 'softdrinks', 250, { size: '0,2 l' }],
  ['apfelschorle', 'Apfelschorle', 'softdrinks', 250, { size: '0,2 l', popular: true }],
  ['wasser', 'Wasser', 'softdrinks', 250, { size: '0,2 l', popular: true }],
  ['flasche-wasser', 'Flasche Wasser', 'softdrinks', 500, { size: '0,75 l', description: 'Für den ganzen Tisch', glass: 'beer', section: 'bottle-nonalc' }],
  ['flasche-cola', 'Flasche Cola', 'softdrinks', 600, { size: '1,0 l', description: 'Zum Teilen', glass: 'beer', section: 'bottle-nonalc' }],
  ['flasche-sprite', 'Flasche Sprite', 'softdrinks', 600, { size: '1,0 l', description: 'Zum Teilen', glass: 'beer', section: 'bottle-nonalc' }],
  ['flasche-fanta', 'Flasche Fanta', 'softdrinks', 600, { size: '1,0 l', description: 'Zum Teilen', glass: 'beer', section: 'bottle-nonalc' }],

  ['koelsch', 'Kölsch', 'bier', 300, { size: '0,33 l', popular: true }],
  ['pils', 'Pils', 'bier', 300, { size: '0,33 l', popular: true }],
  ['radler', 'Radler', 'bier', 300, { size: '0,33 l' }],
  ['radler-00', 'Radler 0,0 %', 'bier', 300, { size: '0,33 l', image: 'radler', badge: '0,0 %' }],
  ['kiste-bier-bitburger', 'Kiste Bitburger', 'bier', 6000, { description: '24 Flaschen Bitburger', image: 'kiste-bier', section: 'beer-crate' }],
  ['kiste-bier-koelsch', 'Kiste Kölsch', 'bier', 6000, { description: '24 Flaschen Kölsch', image: 'kiste-bier', section: 'beer-crate' }],
  ['kiste-bier-gemischt', 'Kiste Gemischt', 'bier', 6000, { description: '10 Bitburger, 10 Kölsch, 4 Radler 0,0 %', image: 'kiste-gemischt', section: 'beer-crate' }],

  ['glas-wein-blanc', 'Glas Blanc de noir', 'wein', 600, { size: '0,2 l', description: 'trocken' }],
  ['glas-wein-weissburgunder', 'Glas Weißburgunder', 'wein', 600, { size: '0,2 l', description: 'trocken' }],
  ['glas-wein-jubilus', 'Glas Jubilus', 'wein', 600, { size: '0,2 l', description: 'feinherb' }],
  ['flasche-wein-blanc', 'Flasche Blanc de noir', 'wein', 2000, { description: 'trocken', glass: 'wine', section: 'wine-bottle' }],
  ['flasche-wein-weissburgunder', 'Flasche Weißburgunder', 'wein', 2000, { description: 'trocken', glass: 'wine', section: 'wine-bottle' }],
  ['flasche-wein-jubilus', 'Flasche Jubilus', 'wein', 2000, { description: 'feinherb', glass: 'wine', section: 'wine-bottle' }],
  ['glas-secco', 'Glas Secco', 'wein', 600, { size: '0,2 l', popular: true }],
  ['flasche-sekt', 'Flasche Sekt', 'wein', 2200, { glass: 'sekt', section: 'wine-bottle' }],
  ['flasche-secco', 'Flasche Secco', 'wein', 1800, { glass: 'sekt', section: 'wine-bottle' }],
  ['luftikuss', 'LuftiKuss', 'wein', 2000, { description: 'Alkoholfreier Sekt', badge: '0 %', glass: 'sekt', section: 'wine-bottle' }],

  ['baerbelchen', 'Bärbelchen', 'kurze', 300],
  ['glitter-pitter', 'Glitter Pitter', 'kurze', 300],
  ['kiste-klopfer-baerbelchen', 'Kiste Bärbelchen', 'kurze', 5000, { image: 'kiste-kurze', section: 'shots-crate' }],
  ['kiste-klopfer-glitter', 'Kiste Glitter Pitter', 'kurze', 5000, { image: 'kiste-kurze', section: 'shots-crate' }],

  ['glas-normal', 'Bierglas (leer)', 'glaeser', 0, { glassFor: 'beer' }],
  ['glas-wein-leer', 'Weinglas (leer)', 'glaeser', 0, { glassFor: 'wine' }],
  ['glas-sekt-leer', 'Sektglas (leer)', 'glaeser', 0, { glassFor: 'sekt' }],
];

export function defaultCatalog(): Catalog {
  const products: Record<string, Product> = {};
  seeds.forEach(([id, name, categoryId, priceCents, extra = {}], i) => {
    const { glass, section, ...rest } = extra;
    products[id] = {
      name,
      categoryId,
      priceCents,
      soldOut: false,
      popular: false,
      sort: i + 1,
      active: true,
      image: id,
      ...(glass ? { glassPrompt: glass } : {}),
      ...(section ? { tableSection: section } : {}),
      ...rest,
    };
  });
  return { categories: structuredClone(categories), products };
}

/** Product id of the empty glass for a glass type, if the catalog has one. */
export function glassProductId(catalog: Catalog, type: GlassType): string | undefined {
  return Object.entries(catalog.products).find(([, p]) => p.glassFor === type && p.active)?.[0];
}
