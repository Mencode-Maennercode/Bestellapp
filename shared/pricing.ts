import type { Catalog, OrderItem } from './types';

export const MAX_LINES = 40;
export const MAX_QTY = 50;

export type OrderErrorCode = 'empty' | 'tooMany' | 'badQty' | 'unknown' | 'soldOut';

export class OrderError extends Error {
  readonly code: OrderErrorCode;
  readonly productId?: string;
  constructor(code: OrderErrorCode, productId?: string) {
    super(code);
    this.code = code;
    this.productId = productId;
  }
}

export interface CartLine {
  productId: string;
  qty: number;
}

/** Prices a cart strictly from the catalog. The client never supplies prices. */
export function priceOrder(lines: CartLine[], catalog: Catalog): { items: OrderItem[]; totalCents: number } {
  const merged = new Map<string, number>();
  for (const l of lines) merged.set(l.productId, (merged.get(l.productId) ?? 0) + l.qty);
  if (merged.size === 0) throw new OrderError('empty');
  if (merged.size > MAX_LINES) throw new OrderError('tooMany');

  const items: OrderItem[] = [];
  for (const [productId, qty] of merged) {
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw new OrderError('badQty', productId);
    const p = catalog.products[productId];
    if (!p || !p.active) throw new OrderError('unknown', productId);
    if (p.soldOut) throw new OrderError('soldOut', productId);
    items.push({ productId, name: p.name, priceCents: p.priceCents, qty });
  }
  const totalCents = items.reduce((sum, i) => sum + i.priceCents * i.qty, 0);
  return { items, totalCents };
}

/** "3× Kölsch, 1× Cola" */
export function summarize(items: Pick<OrderItem, 'name' | 'qty'>[]): string {
  return items.map(i => `${i.qty}× ${i.name}`).join(', ');
}
