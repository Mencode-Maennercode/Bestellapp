import { Megaphone, Pause, Prohibit } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { formatAge, urgencyFor, type Urgency } from '@shared/urgency';
import type { Catalog, OrderItem, SystemState } from '@shared/types';
import { cx, ProductImage } from '@/ui';

/** Urgency colours for the ticket stub / tile header: calm → amber after 3 min → pulsing red after 6. */
export const urgencyClass: Record<Urgency, string> = {
  calm: 'bg-surface-3 text-ink',
  warn: 'bg-warn text-[#1d1204]',
  late: 'bg-late text-[#1a0605] late-pulse',
};

export const urgencyLabel: Record<Urgency, string> = { calm: '', warn: 'wartet', late: 'wartet lange' };

export function Age({ since, now, className }: { since: number; now: number; className?: string }) {
  const age = formatAge(since, now);
  const u = urgencyFor(since, now);
  return (
    <span className={cx('num leading-none font-bold', className)} aria-label={`seit ${age} Minuten${u === 'calm' ? '' : `, ${urgencyLabel[u]}`}`}>
      {age}
    </span>
  );
}

/** Items with small photos; empty glasses collapse into one quiet line. */
export function OrderLines({ items, catalog, size = 'md' }: { items: OrderItem[]; catalog: Catalog; size?: 'md' | 'lg' }) {
  const glasses = items.filter(i => catalog.products[i.productId]?.glassFor);
  const drinks = items.filter(i => !catalog.products[i.productId]?.glassFor);
  const lg = size === 'lg';
  return (
    <div>
      <ul className={cx('flex flex-col', lg ? 'gap-1.5' : 'gap-1')}>
        {drinks.map(i => {
          const p = catalog.products[i.productId];
          return (
            <li key={i.productId} className="flex items-center gap-2.5">
              <ProductImage
                image={p?.image}
                categoryId={p?.categoryId ?? ''}
                sizes={lg ? '48px' : '36px'}
                className={cx('shrink-0 rounded-[10px]', lg ? 'size-12' : 'size-9')}
              />
              <span className={cx('num shrink-0 text-right font-extrabold', lg ? 'min-w-9 text-[2rem] leading-none' : 'min-w-6 text-[1.375rem] leading-none')}>
                {i.qty}
              </span>
              <span className={cx('min-w-0 leading-tight font-bold', lg ? 'text-[1.1875rem]' : 'text-base')}>{i.name}</span>
            </li>
          );
        })}
      </ul>
      {glasses.length > 0 && (
        <p className={cx('mt-2 text-ink-2', lg ? 'text-base' : 'text-[0.9375rem]')}>
          <span className="font-bold text-ink-3">Gläser </span>
          {glasses.map(g => `${g.qty}× ${(catalog.products[g.productId]?.name ?? g.name).replace(/\s*\(leer\)/i, '')}`).join(', ')}
        </p>
      )}
    </div>
  );
}

/** Club sash on top of every staff screen. */
export function Sash() {
  return (
    <div aria-hidden className="flex h-1">
      <span className="flex-1 bg-accent" />
      <span className="flex-1 bg-accent-2" />
    </div>
  );
}

/** Paused / shutdown / announcements, as staff need to know them. */
export function SystemStrip({ system, className }: { system: SystemState; className?: string }) {
  const b = system.broadcast;
  const items: { key: string; icon: ReactNode; text: string; tone: string }[] = [];
  if (system.shutdown) items.push({ key: 's', icon: <Prohibit size={22} weight="bold" />, text: 'Notfall-Stopp: Gäste können nicht bestellen. Bitte Tische direkt ansprechen.', tone: 'bg-late/16 text-[#ffc2bd]' });
  else if (system.ordersPaused) items.push({ key: 'p', icon: <Pause size={22} weight="fill" />, text: 'Gast-Bestellungen pausiert. Kellnerrufe und eure Bestellungen laufen weiter.', tone: 'bg-warn/14 text-[#ffd59a]' });
  if (b && b.target !== 'guests') items.push({ key: 'b', icon: <Megaphone size={22} weight="fill" />, text: b.message, tone: 'bg-accent-2 text-accent-2-ink' });
  if (!items.length) return null;
  return (
    <div className={cx('flex flex-col gap-2', className)}>
      {items.map(i => (
        <p key={i.key} role="status" className={cx('flex items-start gap-3 rounded-[var(--radius-btn)] px-4 py-3 font-bold text-pretty', i.tone)}>
          <span className="mt-px shrink-0">{i.icon}</span>
          {i.text}
        </p>
      ))}
    </div>
  );
}

/** On/off switch with a visible label; the whole row is the hit area. */
export function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-14 w-full items-center gap-4 rounded-[var(--radius-btn)] bg-surface-3 px-4 py-3 text-left shadow-[var(--edge)]"
    >
      <span className="flex-1">
        <span className="block font-bold">{label}</span>
        {hint && <span className="mt-0.5 block text-[0.9375rem] leading-snug text-ink-3">{hint}</span>}
      </span>
      <span aria-hidden className={cx('relative h-8 w-[3.25rem] shrink-0 rounded-full transition-colors duration-200', checked ? 'bg-accent' : 'bg-surface-1')}>
        <span
          className={cx(
            'absolute top-1 left-1 size-6 rounded-full transition-transform duration-200 ease-[var(--ease-out-expo)]',
            checked ? 'translate-x-5 bg-accent-ink' : 'bg-ink-3',
          )}
        />
      </span>
    </button>
  );
}

/** Calm empty state that says what will happen, not just "nothing here". */
export function Quiet({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="py-14 text-center">
      <p className="font-display text-[2.75rem] leading-none font-extrabold uppercase text-ink-2">{title}</p>
      <p className="mx-auto mt-3 max-w-[34ch] text-ink-3 text-pretty">{children}</p>
    </div>
  );
}
