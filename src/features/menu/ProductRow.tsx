import { Plus } from '@phosphor-icons/react';
import { formatEUR } from '@shared/money';
import type { Product } from '@shared/types';
import { Badge, cx, ProductImage, Stepper } from '@/ui';
import type { MenuStrings } from './strings';

interface Props {
  id: string;
  product: Product;
  qty: number;
  onAdd: (id: string) => void;
  onChange: (id: string, qty: number) => void;
  s: MenuStrings;
  /** Cart rows show the line total instead of the unit price. */
  showLineTotal?: boolean;
  disabled?: boolean;
}

/** Compact list row with thumbnail, used in the table sheet and the cart. */
export function ProductRow({ id, product: p, qty, onAdd, onChange, s, showLineTotal, disabled }: Props) {
  const off = p.soldOut || disabled;
  const meta = p.soldOut ? s.soldOut : [p.size, p.description].filter(Boolean).join(' · ');
  return (
    <li className="flex items-center gap-3 py-2.5">
      <ProductImage image={p.image} categoryId={p.categoryId} dim={p.soldOut} sizes="72px" className="size-[4.5rem] shrink-0 rounded-[12px]" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 leading-tight font-bold">
          {p.name}
          {p.badge && <Badge>{p.badge}</Badge>}
        </p>
        {meta && <p className="truncate text-[0.9375rem] text-ink-3">{meta}</p>}
        <p className={cx('num mt-0.5 text-xl leading-none font-bold', p.soldOut && 'text-ink-3 line-through')}>
          {formatEUR(showLineTotal ? p.priceCents * qty : p.priceCents)}
        </p>
      </div>
      {off && !qty ? null : qty > 0 ? (
        <Stepper size="sm" value={qty} onChange={n => onChange(id, n)} label={s.qty(p.name)} tone={showLineTotal ? 'neutral' : 'accent'} />
      ) : (
        <button
          type="button"
          onClick={() => onAdd(id)}
          aria-label={`${s.add(p.name)}, ${formatEUR(p.priceCents)}`}
          className="grid size-12 shrink-0 place-items-center rounded-full bg-surface-3 shadow-[var(--edge)] active:scale-90 transition-transform"
        >
          <Plus size={20} weight="bold" />
        </button>
      )}
    </li>
  );
}
