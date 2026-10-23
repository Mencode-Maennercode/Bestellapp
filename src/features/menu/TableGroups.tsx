import { useState } from 'react';
import { formatEUR } from '@shared/money';
import type { TableSection } from '@shared/types';
import { Badge, cx, ProductImage, Sheet } from '@/ui';
import type { CartApi } from './useCart';
import { ProductRow } from './ProductRow';
import type { TableGroup } from './sections';
import type { MenuStrings } from './strings';

interface Props {
  groups: TableGroup[];
  cart: CartApi;
  s: MenuStrings;
  disabled?: boolean;
}

/** "Für den Tisch": bottles and crates as four big tiles; each opens its list in a sheet. */
export function TableGroups({ groups, cart, s, disabled }: Props) {
  const [open, setOpen] = useState<TableSection | null>(null);
  const current = groups.find(g => g.section === open);

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 @2xl:grid-cols-4">
        {groups.map(g => {
          const inCart = g.products.reduce((n, [id]) => n + (cart.cart[id] ?? 0), 0);
          const allOut = g.products.every(([, p]) => p.soldOut);
          const [, lead] = g.products.find(([, p]) => !p.soldOut) ?? g.products[0];
          return (
            <button
              key={g.section}
              type="button"
              onClick={() => setOpen(g.section)}
              className={cx(
                'relative overflow-hidden rounded-[var(--radius-card)] bg-surface-1 text-left transition-[transform,box-shadow] duration-200 active:scale-[0.985]',
                'shadow-[var(--edge)]', inCart > 0 && 'outline-2 -outline-offset-2 outline-accent-2',
              )}
            >
              <ProductImage image={lead.image} categoryId={lead.categoryId} dim={allOut} sizes="(min-width: 640px) 24vw, 46vw" className="aspect-[4/3] w-full" />
              <div className="px-3.5 pt-1.5 pb-3.5">
                <p className="font-display text-[1.375rem] leading-[1.05] font-extrabold uppercase">{s.sections[g.section]}</p>
                <p className="mt-1 text-[0.9375rem] text-ink-3">
                  {allOut ? s.soldOut : `${s.kinds(g.products.length)} · ${s.from} `}
                  {!allOut && <span className="num text-[1.0625rem] font-bold text-ink-2">{formatEUR(g.fromCents)}</span>}
                </p>
              </div>
              {inCart > 0 && (
                <Badge tone="accent" className="num absolute top-3 right-3 h-7 min-w-7 justify-center text-base">{inCart}</Badge>
              )}
            </button>
          );
        })}
      </div>

      <Sheet open={!!current} onClose={() => setOpen(null)} title={current ? s.sections[current.section] : ''}>
        {current && (
          <ul className="divide-y divide-line">
            {current.products.map(([id, p]) => (
              <ProductRow key={id} id={id} product={p} qty={cart.cart[id] ?? 0} onAdd={cart.add} onChange={cart.change} s={s} disabled={disabled} />
            ))}
          </ul>
        )}
      </Sheet>
    </>
  );
}
