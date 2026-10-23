import { CaretUp } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { formatEUR } from '@shared/money';
import type { Catalog } from '@shared/types';
import { Button, Sheet } from '@/ui';
import { isGlass, type CartApi } from './useCart';
import { ProductRow } from './ProductRow';
import type { MenuStrings } from './strings';

/** Floating bar at the bottom while something is in the cart. */
export function CartBar({ cart, s, onOpen }: { cart: CartApi; s: MenuStrings; onOpen: () => void }) {
  const visible = cart.count > 0 || cart.total > 0;
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,var(--safe-bottom))]"
          initial={{ y: '120%' }}
          animate={{ y: 0 }}
          exit={{ y: '120%' }}
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        >
          <button
            type="button"
            onClick={onOpen}
            className="mx-auto flex min-h-16 w-full max-w-xl items-center gap-4 rounded-[18px] bg-accent py-2 pr-3 pl-5 text-accent-ink shadow-[0_14px_40px_rgb(0_0_0/0.55)] transition-transform active:scale-[0.985]"
          >
            <span className="flex flex-1 flex-col items-start leading-tight">
              <span className="text-[0.9375rem] font-bold opacity-80">{s.drinks(cart.count)}</span>
              <motion.span key={cart.total} initial={{ y: 6, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }} className="num text-[1.75rem] leading-none font-extrabold">
                {formatEUR(cart.total)}
              </motion.span>
            </span>
            <span className="flex min-h-12 items-center gap-1.5 rounded-[12px] bg-black/12 px-4 font-bold">
              {s.showCart}
              <CaretUp size={18} weight="bold" />
            </span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface SheetProps {
  open: boolean;
  onClose: () => void;
  cart: CartApi;
  catalog: Catalog;
  s: MenuStrings;
  subtitle?: ReactNode;
  /** Extra controls above the total (waiter: note, "an Theke senden"). */
  extra?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  submitLabel: string;
  busy?: boolean;
  disabled?: boolean;
  onSubmit: () => void;
}

/** Review the order, adjust quantities, send. */
export function CartSheet({ open, onClose, cart, catalog, s, subtitle, extra, hint, error, submitLabel, busy, disabled, onSubmit }: SheetProps) {
  const lines = Object.entries(cart.cart)
    .filter(([id]) => catalog.products[id])
    .sort(([a], [b]) => Number(isGlass(catalog.products[a])) - Number(isGlass(catalog.products[b])) || catalog.products[a].sort - catalog.products[b].sort);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={s.cartTitle}
      subtitle={subtitle}
      footer={
        <div className="flex flex-col gap-3">
          {error && (
            <p role="alert" className="rounded-[12px] bg-late/14 px-4 py-3 font-semibold text-[#ffb0aa]">
              {error}
            </p>
          )}
          <div className="flex items-baseline justify-between">
            <span className="font-bold text-ink-2">{s.total}</span>
            <span className="num text-[2.25rem] leading-none font-extrabold">{formatEUR(cart.total)}</span>
          </div>
          {hint && <p className="-mt-1 text-[0.9375rem] text-ink-3">{hint}</p>}
          <Button size="lg" busy={busy} disabled={disabled || !lines.length} onClick={onSubmit} className="w-full">
            {submitLabel}
          </Button>
        </div>
      }
    >
      <ul className="divide-y divide-line">
        {lines.map(([id, qty]) => (
          <ProductRow key={id} id={id} product={catalog.products[id]} qty={qty} onAdd={cart.add} onChange={cart.change} s={s} showLineTotal />
        ))}
      </ul>
      {extra && <div className="mt-3">{extra}</div>}
    </Sheet>
  );
}
