import { useCallback, useEffect, useMemo, useState } from 'react';
import { glassProductId } from '@shared/catalog-seed';
import { MAX_QTY, type CartLine } from '@shared/pricing';
import type { Catalog, GlassType, Product } from '@shared/types';

export type Cart = Record<string, number>;

export const isGlass = (p?: Product) => !!p?.glassFor;

/** Preview only. The server prices every order again from its own catalog. */
export function cartTotal(cart: Cart, catalog: Catalog): number {
  return Object.entries(cart).reduce((sum, [id, qty]) => sum + (catalog.products[id]?.priceCents ?? 0) * qty, 0);
}

/** Drinks in the cart; empty glasses are not counted. */
export function cartCount(cart: Cart, catalog: Catalog): number {
  return Object.entries(cart).reduce((n, [id, qty]) => n + (isGlass(catalog.products[id]) ? 0 : qty), 0);
}

export function toLines(cart: Cart): CartLine[] {
  return Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([productId, qty]) => ({ productId, qty }));
}

/** Drops products that vanished or sold out since they were added. */
function prune(cart: Cart, catalog: Catalog): Cart {
  const out: Cart = {};
  for (const [id, qty] of Object.entries(cart)) {
    const p = catalog.products[id];
    if (p && p.active && !p.soldOut && qty > 0) out[id] = Math.min(qty, MAX_QTY);
  }
  return out;
}

function load(key: string | null): Cart {
  if (!key) return {};
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? '{}') as Cart;
  } catch {
    return {};
  }
}

export interface GlassPrompt {
  productId: string;
  type: GlassType;
  glassId: string;
}

/**
 * Cart state shared by guest and waiter menus. Adding a bottle with `glassPrompt` opens the
 * "how many glasses?" question; the answer adds the matching empty-glass product.
 */
export function useCart(catalog: Catalog | null, storageKey: string | null) {
  const [raw, setRaw] = useState<Cart>(() => load(storageKey));
  const [glassPrompt, setGlassPrompt] = useState<GlassPrompt | null>(null);

  const cart = useMemo(() => (catalog ? prune(raw, catalog) : raw), [raw, catalog]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(cart));
    } catch {
      /* storage blocked: cart just lives in memory */
    }
  }, [cart, storageKey]);

  const setQty = useCallback((id: string, qty: number) => {
    setRaw(c => {
      const next = { ...c };
      if (qty <= 0) delete next[id];
      else next[id] = Math.min(qty, MAX_QTY);
      return next;
    });
  }, []);

  const add = useCallback(
    (id: string) => {
      const p = catalog?.products[id];
      if (!catalog || !p || p.soldOut || !p.active) return;
      setRaw(c => ({ ...c, [id]: Math.min((c[id] ?? 0) + 1, MAX_QTY) }));
      const glassId = p.glassPrompt ? glassProductId(catalog, p.glassPrompt) : undefined;
      if (p.glassPrompt && glassId && !catalog.products[glassId].soldOut) {
        setGlassPrompt({ productId: id, type: p.glassPrompt, glassId });
      }
    },
    [catalog],
  );

  /** Increase/decrease from a stepper; increases go through `add` so bottles ask for glasses. */
  const change = useCallback(
    (id: string, qty: number) => {
      const current = raw[id] ?? 0;
      if (qty > current) add(id);
      else setQty(id, qty);
    },
    [raw, add, setQty],
  );

  const answerGlasses = useCallback(
    (n: number) => {
      if (glassPrompt && n > 0) setRaw(c => ({ ...c, [glassPrompt.glassId]: Math.min((c[glassPrompt.glassId] ?? 0) + n, MAX_QTY) }));
      setGlassPrompt(null);
    },
    [glassPrompt],
  );

  const clear = useCallback(() => setRaw({}), []);

  return {
    cart,
    count: catalog ? cartCount(cart, catalog) : 0,
    total: catalog ? cartTotal(cart, catalog) : 0,
    add,
    change,
    setQty,
    clear,
    glassPrompt,
    answerGlasses,
  };
}

export type CartApi = ReturnType<typeof useCart>;
