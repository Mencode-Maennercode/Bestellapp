import { Check, Receipt } from '@phosphor-icons/react';
import { motion } from 'motion/react';
import { urgencyFor } from '@shared/urgency';
import type { Catalog, Order } from '@shared/types';
import { Button, cx } from '@/ui';
import { Age, OrderLines, urgencyClass } from '@/features/staff/parts';

interface Props {
  id: string;
  order: Order;
  catalog: Catalog;
  now: number;
  busy?: boolean;
  onReady: (id: string) => void;
}

/** One ticket on the bar board. The header turns amber, then red as the table waits. */
export function BarTile({ id, order: o, catalog, now, busy, onReady }: Props) {
  const u = urgencyFor(o.createdAt, now);
  const who = o.claimedBy?.name ?? o.waiterName;
  const isTab = o.type === 'tab';
  return (
    <motion.li
      layout
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 36 }}
      className="flex flex-col overflow-hidden rounded-[var(--radius-card)] bg-surface-1 shadow-[var(--edge)]"
    >
      <header className={cx('flex items-center gap-3 px-4 py-3', urgencyClass[u])}>
        {isTab ? (
          <span className="flex items-center gap-2 font-display text-[2.25rem] leading-none font-extrabold uppercase">
            <Receipt size={28} weight="bold" aria-hidden /> Bon
          </span>
        ) : (
          <span className="num text-[3.25rem] leading-[0.85] font-extrabold">
            <span className="sr-only">Tisch </span>
            {o.tableLabel}
          </span>
        )}
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-lg font-bold">{who ?? 'Noch offen'}</span>
          <span className="block truncate text-[0.9375rem] font-semibold opacity-75">
            {isTab ? o.note || 'Schnellbon' : o.source === 'guest' ? 'vom Gast' : 'vom Kellner'}
          </span>
        </span>
        <Age since={o.createdAt} now={now} className="text-[1.75rem]" />
      </header>
      <div className="flex-1 px-4 pt-3.5 pb-4">
        <OrderLines items={o.items} catalog={catalog} size="lg" />
      </div>
      <div className="px-3 pb-3">
        <Button size="lg" className="w-full" busy={busy} icon={<Check size={22} weight="bold" />} onClick={() => onReady(id)}>
          Fertig
        </Button>
      </div>
    </motion.li>
  );
}
