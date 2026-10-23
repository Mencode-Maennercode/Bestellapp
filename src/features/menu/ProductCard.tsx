import { Plus } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
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
  disabled?: boolean;
}

const pop = { type: 'spring', stiffness: 600, damping: 34 } as const;

/** Photo card. Tapping anywhere adds one; the plus morphs into a stepper once it is in the cart. */
export function ProductCard({ id, product: p, qty, onAdd, onChange, s, disabled }: Props) {
  const off = p.soldOut || disabled;
  const meta = p.soldOut ? s.soldOut : [p.size, p.description].filter(Boolean).join(' · ');
  return (
    <article
      className={cx(
        'relative overflow-hidden rounded-[var(--radius-card)] bg-surface-1 transition-shadow duration-300',
        'shadow-[var(--edge)]', qty > 0 && 'outline-2 -outline-offset-2 outline-accent-2',
      )}
    >
      <button
        type="button"
        onClick={() => onAdd(id)}
        disabled={off}
        aria-label={`${s.add(p.name)}, ${formatEUR(p.priceCents)}${qty ? `, ${qty} im Warenkorb` : ''}`}
        className="block w-full text-left transition-transform duration-150 active:scale-[0.985] disabled:active:scale-100"
      >
        <ProductImage
          image={p.image}
          categoryId={p.categoryId}
          dim={p.soldOut}
          sizes="(min-width: 1024px) 22vw, (min-width: 640px) 30vw, 46vw"
          className="aspect-square w-full"
        />
        <div className="flex flex-col gap-1 px-3.5 pt-2 pb-3.5">
          <h3 className="text-[1.0625rem] leading-tight font-bold text-pretty">{p.name}</h3>
          {meta && <p className="text-[0.9375rem] leading-snug text-ink-3">{meta}</p>}
          <p className={cx('num mt-1 text-[1.75rem] leading-none font-bold', p.soldOut && 'text-ink-3 line-through decoration-2')}>
            {formatEUR(p.priceCents)}
          </p>
        </div>
      </button>

      {p.badge && <Badge className="absolute top-3 left-3">{p.badge}</Badge>}

      {!off && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex aspect-square items-end justify-end p-2.5">
          <AnimatePresence initial={false} mode="popLayout">
            {qty > 0 ? (
              <motion.div key="stepper" className="pointer-events-auto" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={pop}>
                <Stepper size="sm" tone="accent" value={qty} onChange={n => onChange(id, n)} label={s.qty(p.name)} />
              </motion.div>
            ) : (
              <motion.button
                key="plus"
                type="button"
                tabIndex={-1}
                aria-hidden
                onClick={() => onAdd(id)}
                className="pointer-events-auto grid size-11 place-items-center rounded-full bg-surface-3/90 text-ink shadow-[var(--edge)]"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={pop}
                whileTap={{ scale: 0.88 }}
              >
                <Plus size={20} weight="bold" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      )}
    </article>
  );
}
