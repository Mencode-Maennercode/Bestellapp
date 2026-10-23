// Money is always integer cents. Never use floats for amounts.

const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

export function formatEUR(cents: number): string {
  return eur.format(cents / 100);
}

/** Parses "2,50", "2.50", "2" or "2,5 €" into cents. Returns null for invalid input. */
export function parseEUR(input: string): number | null {
  const s = input.replace(/€|\s/g, '').replace(',', '.');
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

/** Commission share in cents, rounded half up. `permille` 15 = 1.5 %. */
export function shareCents(cents: number, permille: number): number {
  return Math.round((cents * permille) / 1000);
}
